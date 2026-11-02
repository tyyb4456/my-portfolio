from __future__ import annotations

import asyncio
import sys
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from typing import Any, cast

import pytest
from httpx import ASGITransport, AsyncClient
from langgraph.checkpoint.base import CheckpointMetadata
from langgraph.checkpoint.base.id import uuid6
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from sqlalchemy import delete, select

from app.agents.main_agent import memory_namespace
from app.api.routes.chat import get_checkpointer, get_memory_store
from app.auth import ClerkUser, require_auth
from app.core.config import Settings, get_settings
from app.db.session import SessionLocal, get_session
from app.main import app
from app.models.chat_thread import ChatThread
from app.models.report import Report
from app.services import retention as retention_module
from app.services.account_erasure import (
    AccountErasureIncomplete,
    erase_account_data,
)
from app.services.chat_memory import (
    delete_picker_memory,
    redact_memory_items_containing,
)
from app.services.checkpoint_threads import checkpoint_thread_evidence
from app.services.report_deletion import (
    ReportDeletionStorageError,
    delete_owned_report,
)
from app.services.retention import purge_expired_chat_threads

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


RAW_TEXT = "I sold 12 kg plastic for 180 rupees per kg in Multan"
OTHER_TEXT = "My usual area is Multan"


class FakeStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, ...], dict[str, Any]] = {}

    async def asearch(
        self,
        namespace: tuple[str, ...],
        *,
        limit: int = 10,
        offset: int = 0,
        **_kwargs: Any,
    ) -> list[SimpleNamespace]:
        keys = sorted(self.items.get(namespace, {}))
        return [
            SimpleNamespace(key=key, value=self.items[namespace][key])
            for key in keys[offset : offset + limit]
        ]

    async def adelete(self, namespace: tuple[str, ...], key: str) -> None:
        self.items.get(namespace, {}).pop(key, None)

    async def aput(
        self,
        namespace: tuple[str, ...],
        key: str,
        value: dict[str, Any],
    ) -> None:
        self.items.setdefault(namespace, {})[key] = value


class FailOnceStore(FakeStore):
    def __init__(self) -> None:
        super().__init__()
        self.failed = False

    async def asearch(self, *args: Any, **kwargs: Any) -> list[SimpleNamespace]:
        if not self.failed:
            self.failed = True
            raise RuntimeError("memory store is down")
        return await super().asearch(*args, **kwargs)


class FakeCheckpointer:
    def __init__(self) -> None:
        self.deleted: list[str] = []
        self.fail = False

    async def adelete_thread(self, thread_id: str) -> None:
        if self.fail:
            raise RuntimeError("checkpoint store is down")
        self.deleted.append(thread_id)


class SelectiveFailCheckpointer:
    """Fail once for one thread id, then delegate to the real checkpointer."""

    def __init__(self, saver: AsyncPostgresSaver, fail_thread_id: str) -> None:
        self.saver = saver
        self.fail_thread_id = fail_thread_id
        self.failed = False

    async def adelete_thread(self, thread_id: str) -> None:
        if thread_id == self.fail_thread_id and not self.failed:
            self.failed = True
            raise RuntimeError("checkpoint store is down")
        await self.saver.adelete_thread(thread_id)


@pytest.fixture
async def postgres_storage(
    postgres_db: None,
) -> AsyncIterator[tuple[AsyncPostgresSaver, AsyncPostgresStore]]:
    settings = get_settings()
    pool = cast(
        AsyncConnectionPool[AsyncConnection[dict[str, Any]]],
        AsyncConnectionPool(
            conninfo=settings.postgres_uri,
            min_size=1,
            max_size=2,
            open=False,
            kwargs={
                "autocommit": True,
                "prepare_threshold": 0,
                "row_factory": dict_row,
            },
        ),
    )
    await pool.open()
    try:
        checkpointer = AsyncPostgresSaver(pool)
        await checkpointer.setup()
        store = AsyncPostgresStore(pool)
        await store.setup()
        yield checkpointer, store
    finally:
        await pool.close()


async def _create_thread(
    session: Any,
    *,
    picker_id: str,
    updated_at: datetime | None = None,
) -> ChatThread:
    thread = ChatThread(user_id=picker_id, title="deletion test")
    if updated_at is not None:
        thread.created_at = updated_at
        thread.updated_at = updated_at
    session.add(thread)
    await session.commit()
    await session.refresh(thread)
    return thread


async def _create_report(
    session: Any,
    *,
    picker_id: str,
    raw_text: str = RAW_TEXT,
    source_thread_id: uuid.UUID | None = None,
) -> Report:
    report = Report(
        picker_id=picker_id,
        raw_text=raw_text,
        source_thread_id=source_thread_id,
        material="plastic",
        price_per_kg=Decimal("180"),
        quantity_kg=Decimal("12"),
        anomaly_reason="test fixture",
        anomaly_method="test",
    )
    session.add(report)
    await session.commit()
    await session.refresh(report)
    return report


async def _put_checkpoint(
    checkpointer: AsyncPostgresSaver,
    thread_id: uuid.UUID,
    *,
    picker_id: str | None = None,
    ts: datetime | str | None = None,
    checkpoint_id: str | None = None,
) -> None:
    metadata: dict[str, Any] = {
        "source": "input",
        "step": 0,
        "parents": {},
        "run_id": str(uuid.uuid4()),
    }
    if picker_id is not None:
        metadata["picker_id"] = picker_id
    if ts is None:
        checkpoint_ts = datetime.now(UTC).isoformat()
    elif isinstance(ts, datetime):
        checkpoint_ts = ts.isoformat()
    else:
        checkpoint_ts = ts
    await checkpointer.aput(
        {"configurable": {"thread_id": str(thread_id), "checkpoint_ns": ""}},
        {
            "v": 1,
            "id": checkpoint_id or str(uuid6()),
            "ts": checkpoint_ts,
            "channel_values": {"messages": []},
            "channel_versions": {"messages": "1"},
            "versions_seen": {},
            "updated_channels": ["messages"],
        },
        cast(CheckpointMetadata, metadata),
        {"messages": "1"},
    )


async def _has_checkpoint(
    checkpointer: AsyncPostgresSaver,
    thread_id: uuid.UUID,
) -> bool:
    tuple_ = await checkpointer.aget_tuple(
        {"configurable": {"thread_id": str(thread_id), "checkpoint_ns": ""}}
    )
    return tuple_ is not None


async def _has_specific_checkpoint(
    checkpointer: AsyncPostgresSaver,
    thread_id: uuid.UUID,
    checkpoint_id: str,
) -> bool:
    tuple_ = await checkpointer.aget_tuple(
        {
            "configurable": {
                "thread_id": str(thread_id),
                "checkpoint_ns": "",
                "checkpoint_id": checkpoint_id,
            }
        }
    )
    return tuple_ is not None


async def _cleanup(picker_ids: list[str]) -> None:
    async with SessionLocal() as session:
        await session.execute(delete(Report).where(Report.picker_id.in_(picker_ids)))
        await session.execute(
            delete(ChatThread).where(ChatThread.user_id.in_(picker_ids))
        )
        await session.commit()


async def test_targeted_memory_redaction_is_picker_scoped_and_keeps_other_notes() -> None:
    store = FakeStore()
    owner = (f"picker-a-{uuid.uuid4().hex}",)
    stranger = (f"picker-b-{uuid.uuid4().hex}",)
    store.items[owner] = {
        "/memories/picker_notes.md": {"content": RAW_TEXT},
        "/memories/area.md": {"content": OTHER_TEXT},
        "/memories/mixed.md": {
            "content": f"Kept note.\n{RAW_TEXT}\nAnother kept note."
        },
        "/memories/list.md": {"content": ["unrelated", {"note": RAW_TEXT}]},
    }
    store.items[stranger] = {
        "/memories/picker_notes.md": {"content": RAW_TEXT},
    }

    affected = await redact_memory_items_containing(
        store=store,  # type: ignore[arg-type]
        picker_id=owner[0],
        text=RAW_TEXT,
    )

    assert affected == 3
    assert "/memories/picker_notes.md" not in store.items[owner]
    assert store.items[owner]["/memories/area.md"] == {"content": OTHER_TEXT}
    assert store.items[owner]["/memories/mixed.md"] == {
        "content": "Kept note.\n\nAnother kept note."
    }
    assert store.items[owner]["/memories/list.md"] == {"content": ["unrelated"]}
    assert store.items[stranger] == {"/memories/picker_notes.md": {"content": RAW_TEXT}}


async def test_targeted_memory_redaction_is_idempotent_and_self_cleans(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    _, store = postgres_storage
    picker_id = f"picker-{uuid.uuid4().hex}"
    namespace = memory_namespace(picker_id)
    await store.aput(namespace, "/memories/notes.md", {"content": RAW_TEXT})
    await store.aput(namespace, "/memories/area.md", {"content": OTHER_TEXT})

    try:
        first = await redact_memory_items_containing(
            store=store, picker_id=picker_id, text=RAW_TEXT
        )
        second = await redact_memory_items_containing(
            store=store, picker_id=picker_id, text=RAW_TEXT
        )
        remaining = [item.key for item in await store.asearch(namespace, limit=10)]
    finally:
        await delete_picker_memory(store=store, picker_id=picker_id)

    assert first == 1
    assert second == 0
    assert remaining == ["/memories/area.md"]


async def test_report_deletion_removes_owned_report_history_and_matching_memory(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, store = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    stranger = f"picker-{uuid.uuid4().hex}"
    namespace = memory_namespace(owner)
    stranger_namespace = memory_namespace(stranger)
    await store.aput(namespace, "/memories/notes.md", {"content": RAW_TEXT})
    await store.aput(namespace, "/memories/area.md", {"content": OTHER_TEXT})
    await store.aput(stranger_namespace, "/memories/notes.md", {"content": RAW_TEXT})

    try:
        async with SessionLocal() as session:
            source_thread = await _create_thread(session, picker_id=owner)
            kept_thread = await _create_thread(session, picker_id=owner)
            report = await _create_report(
                session,
                picker_id=owner,
                source_thread_id=source_thread.id,
            )
            kept_report = await _create_report(
                session,
                picker_id=owner,
                raw_text=OTHER_TEXT,
                source_thread_id=kept_thread.id,
            )
        await _put_checkpoint(checkpointer, source_thread.id)
        await _put_checkpoint(checkpointer, kept_thread.id)

        async with SessionLocal() as session:
            deleted = await delete_owned_report(
                session,
                report_id=report.id,
                picker_id=owner,
                checkpointer=checkpointer,
                store=store,
            )

        async with SessionLocal() as session:
            assert await session.get(Report, report.id) is None
            assert await session.get(Report, kept_report.id) is not None
            assert await session.get(ChatThread, source_thread.id) is None
            assert await session.get(ChatThread, kept_thread.id) is not None

        assert deleted is True
        assert not await _has_checkpoint(checkpointer, source_thread.id)
        assert await _has_checkpoint(checkpointer, kept_thread.id)
        assert [item.key for item in await store.asearch(namespace, limit=10)] == [
            "/memories/area.md"
        ]
        assert [
            item.key for item in await store.asearch(stranger_namespace, limit=10)
        ] == ["/memories/notes.md"]
    finally:
        await _cleanup([owner, stranger])
        await delete_picker_memory(store=store, picker_id=owner)
        await delete_picker_memory(store=store, picker_id=stranger)


async def test_report_deletion_keeps_a_thread_shared_with_other_reports(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, store = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    namespace = memory_namespace(owner)
    await store.aput(
        namespace,
        "/memories/picker_notes.md",
        {"content": f"Kept note.\n{RAW_TEXT}\nAnother kept note."},
    )

    try:
        async with SessionLocal() as session:
            shared_thread = await _create_thread(session, picker_id=owner)
            report = await _create_report(
                session,
                picker_id=owner,
                source_thread_id=shared_thread.id,
            )
            sibling = await _create_report(
                session,
                picker_id=owner,
                raw_text=OTHER_TEXT,
                source_thread_id=shared_thread.id,
            )
        await _put_checkpoint(checkpointer, shared_thread.id)

        async with SessionLocal() as session:
            deleted = await delete_owned_report(
                session,
                report_id=report.id,
                picker_id=owner,
                checkpointer=checkpointer,
                store=store,
            )

        assert deleted is True
        async with SessionLocal() as session:
            assert await session.get(Report, report.id) is None
            assert await session.get(Report, sibling.id) is not None
            assert await session.get(ChatThread, shared_thread.id) is not None

        assert await _has_checkpoint(checkpointer, shared_thread.id)
        notes = await store.asearch(namespace, limit=10)
        assert [item.key for item in notes] == ["/memories/picker_notes.md"]
        assert notes[0].value == {"content": "Kept note.\n\nAnother kept note."}
    finally:
        await _cleanup([owner])
        await delete_picker_memory(store=store, picker_id=owner)


async def test_report_deletion_of_a_legacy_report_keeps_chat_history(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, store = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"

    try:
        async with SessionLocal() as session:
            thread = await _create_thread(session, picker_id=owner)
            report = await _create_report(session, picker_id=owner)
        await _put_checkpoint(checkpointer, thread.id)

        async with SessionLocal() as session:
            deleted = await delete_owned_report(
                session,
                report_id=report.id,
                picker_id=owner,
                checkpointer=checkpointer,
                store=store,
            )

        assert deleted is True
        async with SessionLocal() as session:
            assert await session.get(Report, report.id) is None
            assert await session.get(ChatThread, thread.id) is not None
        assert await _has_checkpoint(checkpointer, thread.id)
    finally:
        await _cleanup([owner])


async def test_report_deletion_rejects_a_foreign_report(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, store = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    attacker = f"picker-{uuid.uuid4().hex}"

    try:
        async with SessionLocal() as session:
            source_thread = await _create_thread(session, picker_id=owner)
            report = await _create_report(
                session,
                picker_id=owner,
                source_thread_id=source_thread.id,
            )
        await _put_checkpoint(checkpointer, source_thread.id)

        async with SessionLocal() as session:
            deleted = await delete_owned_report(
                session,
                report_id=report.id,
                picker_id=attacker,
                checkpointer=checkpointer,
                store=store,
            )

        async with SessionLocal() as session:
            assert await session.get(Report, report.id) is not None
            assert await session.get(ChatThread, source_thread.id) is not None

        assert deleted is False
        assert await _has_checkpoint(checkpointer, source_thread.id)
    finally:
        await _cleanup([owner, attacker])


async def test_report_deletion_failure_never_reports_success(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    _, store = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    checkpointer = FakeCheckpointer()
    checkpointer.fail = True

    try:
        async with SessionLocal() as session:
            source_thread = await _create_thread(session, picker_id=owner)
            report = await _create_report(
                session,
                picker_id=owner,
                source_thread_id=source_thread.id,
            )

        async with SessionLocal() as session:
            with pytest.raises(ReportDeletionStorageError):
                await delete_owned_report(
                    session,
                    report_id=report.id,
                    picker_id=owner,
                    checkpointer=checkpointer,  # type: ignore[arg-type]
                    store=store,
                )

        async with SessionLocal() as session:
            assert await session.get(Report, report.id) is not None
            assert await session.get(ChatThread, source_thread.id) is not None
    finally:
        await _cleanup([owner])


async def test_account_erasure_removes_only_owned_data(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, store = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    stranger = f"picker-{uuid.uuid4().hex}"
    owner_namespace = memory_namespace(owner)
    stranger_namespace = memory_namespace(stranger)
    await store.aput(owner_namespace, "/memories/notes.md", {"content": RAW_TEXT})
    await store.aput(owner_namespace, "/memories/area.md", {"content": OTHER_TEXT})
    await store.aput(stranger_namespace, "/memories/notes.md", {"content": RAW_TEXT})

    try:
        async with SessionLocal() as session:
            owner_threads = [
                await _create_thread(session, picker_id=owner) for _ in range(2)
            ]
            stranger_thread = await _create_thread(session, picker_id=stranger)
            for thread in owner_threads:
                await _create_report(
                    session,
                    picker_id=owner,
                    source_thread_id=thread.id,
                )
            stranger_report = await _create_report(
                session,
                picker_id=stranger,
                source_thread_id=stranger_thread.id,
            )
        for thread in [*owner_threads, stranger_thread]:
            await _put_checkpoint(checkpointer, thread.id)

        async with SessionLocal() as session:
            result = await erase_account_data(
                session,
                picker_id=owner,
                checkpointer=checkpointer,
                store=store,
            )

        assert result.reports_deleted == 2
        assert result.threads_deleted == 2
        assert result.memory_items_deleted == 2

        async with SessionLocal() as session:
            assert (
                await session.scalar(
                    select(Report).where(Report.picker_id == owner)
                )
                is None
            )
            assert (
                await session.scalar(
                    select(ChatThread).where(ChatThread.user_id == owner)
                )
                is None
            )
            assert await session.get(Report, stranger_report.id) is not None
            assert await session.get(ChatThread, stranger_thread.id) is not None

        assert await store.asearch(owner_namespace, limit=10) == []
        assert [
            item.key for item in await store.asearch(stranger_namespace, limit=10)
        ] == ["/memories/notes.md"]
        assert await _has_checkpoint(checkpointer, stranger_thread.id)
        for thread in owner_threads:
            assert not await _has_checkpoint(checkpointer, thread.id)
    finally:
        await _cleanup([owner, stranger])
        await delete_picker_memory(store=store, picker_id=owner)
        await delete_picker_memory(store=store, picker_id=stranger)


async def test_account_erasure_removes_attributed_orphan_checkpoints(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, store = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    stranger = f"picker-{uuid.uuid4().hex}"
    orphan_thread = uuid.uuid4()

    try:
        async with SessionLocal() as session:
            thread = await _create_thread(session, picker_id=owner)
            stranger_thread = await _create_thread(session, picker_id=stranger)
            await _create_report(
                session,
                picker_id=owner,
                source_thread_id=thread.id,
            )
        await _put_checkpoint(checkpointer, thread.id, picker_id=owner)
        await _put_checkpoint(checkpointer, orphan_thread, picker_id=owner)
        await _put_checkpoint(checkpointer, stranger_thread.id, picker_id=owner)

        async with SessionLocal() as session:
            result = await erase_account_data(
                session,
                picker_id=owner,
                checkpointer=checkpointer,
                store=store,
            )

        assert result.threads_deleted == 1
        async with SessionLocal() as session:
            assert await session.get(ChatThread, thread.id) is None
            assert await session.get(ChatThread, stranger_thread.id) is not None
        assert not await _has_checkpoint(checkpointer, thread.id)
        assert not await _has_checkpoint(checkpointer, orphan_thread)
        assert await _has_checkpoint(checkpointer, stranger_thread.id)
    finally:
        await _cleanup([owner, stranger])


async def test_account_erasure_preserves_foreign_and_unattributed_orphans(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, store = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    stranger = f"picker-{uuid.uuid4().hex}"
    foreign_orphan = uuid.uuid4()
    unattributed_orphan = uuid.uuid4()

    try:
        await _put_checkpoint(checkpointer, foreign_orphan, picker_id=stranger)
        await _put_checkpoint(checkpointer, unattributed_orphan)

        async with SessionLocal() as session:
            await erase_account_data(
                session,
                picker_id=owner,
                checkpointer=checkpointer,
                store=store,
            )

        assert await _has_checkpoint(checkpointer, foreign_orphan)
        assert await _has_checkpoint(checkpointer, unattributed_orphan)
    finally:
        await checkpointer.adelete_thread(str(foreign_orphan))
        await checkpointer.adelete_thread(str(unattributed_orphan))
        await _cleanup([owner, stranger])


async def test_account_erasure_failure_is_retryable(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, store = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    namespace = memory_namespace(owner)
    await store.aput(namespace, "/memories/notes.md", {"content": RAW_TEXT})

    try:
        async with SessionLocal() as session:
            thread = await _create_thread(session, picker_id=owner)
            report = await _create_report(
                session,
                picker_id=owner,
                source_thread_id=thread.id,
            )
        await _put_checkpoint(checkpointer, thread.id)

        flaky_store = FailOnceStore()
        async with SessionLocal() as session:
            with pytest.raises(AccountErasureIncomplete) as first_attempt:
                await erase_account_data(
                    session,
                    picker_id=owner,
                    checkpointer=checkpointer,
                    store=flaky_store,  # type: ignore[arg-type]
                )
        assert first_attempt.value.stage == "memory"

        async with SessionLocal() as session:
            assert await session.get(Report, report.id) is not None
            assert await session.get(ChatThread, thread.id) is not None

        async with SessionLocal() as session:
            result = await erase_account_data(
                session,
                picker_id=owner,
                checkpointer=checkpointer,
                store=store,
            )

        assert result.reports_deleted == 1
        assert result.threads_deleted == 1
        assert result.memory_items_deleted == 1
        async with SessionLocal() as session:
            assert await session.get(Report, report.id) is None
            assert await session.get(ChatThread, thread.id) is None
        assert await store.asearch(namespace, limit=10) == []
    finally:
        await _cleanup([owner])
        await delete_picker_memory(store=store, picker_id=owner)


async def test_purge_expired_threads_removes_checkpoints_and_metadata(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    picker_id = f"picker-{uuid.uuid4().hex}"
    now = datetime.now(UTC)
    old_at = now - timedelta(days=10)

    try:
        async with SessionLocal() as session:
            expired = await _create_thread(
                session,
                picker_id=picker_id,
                updated_at=old_at,
            )
            fresh = await _create_thread(session, picker_id=picker_id)
        await _put_checkpoint(checkpointer, expired.id)
        await _put_checkpoint(checkpointer, fresh.id)

        deleted = await purge_expired_chat_threads(
            settings=Settings(chat_retention_days=7),
            now=now,
        )

        async with SessionLocal() as session:
            assert await session.get(ChatThread, expired.id) is None
            assert await session.get(ChatThread, fresh.id) is not None
        assert deleted >= 1
        assert not await _has_checkpoint(checkpointer, expired.id)
        assert await _has_checkpoint(checkpointer, fresh.id)
    finally:
        await _cleanup([picker_id])


async def test_purge_preserves_recent_orphan_checkpoint_threads(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    orphan_thread = uuid.uuid4()
    now = datetime.now(UTC)

    try:
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=owner,
            ts=now - timedelta(hours=1),
        )

        deleted = await purge_expired_chat_threads(
            settings=Settings(
                chat_retention_days=7,
                chat_orphan_min_age_hours=24,
            ),
            checkpointer=checkpointer,
            now=now,
        )

        assert deleted == 0
        assert await _has_checkpoint(checkpointer, orphan_thread)
    finally:
        await checkpointer.adelete_thread(str(orphan_thread))


async def test_purge_removes_stale_orphan_checkpoint_threads(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    orphan_thread = uuid.uuid4()
    now = datetime.now(UTC)

    try:
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=owner,
            ts=now - timedelta(days=8),
        )

        deleted = await purge_expired_chat_threads(
            settings=Settings(
                chat_retention_days=7,
                chat_orphan_min_age_hours=24,
            ),
            checkpointer=checkpointer,
            now=now,
        )

        assert deleted == 1
        assert not await _has_checkpoint(checkpointer, orphan_thread)
    finally:
        await checkpointer.adelete_thread(str(orphan_thread))


async def test_purge_preserves_orphan_with_unknown_timestamp(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    orphan_thread = uuid.uuid4()
    now = datetime.now(UTC)

    try:
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=owner,
            ts="not-a-timestamp",
        )

        deleted = await purge_expired_chat_threads(
            settings=Settings(
                chat_retention_days=7,
                chat_orphan_min_age_hours=24,
            ),
            checkpointer=checkpointer,
            now=now,
        )

        assert deleted == 0
        assert await _has_checkpoint(checkpointer, orphan_thread)
    finally:
        await checkpointer.adelete_thread(str(orphan_thread))


async def test_purge_preserves_stale_orphan_with_unknown_owner(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    orphan_thread = uuid.uuid4()
    now = datetime.now(UTC)

    try:
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            ts=now - timedelta(days=8),
        )

        deleted = await purge_expired_chat_threads(
            settings=Settings(
                chat_retention_days=7,
                chat_orphan_min_age_hours=24,
            ),
            checkpointer=checkpointer,
            now=now,
        )

        assert deleted == 0
        assert await _has_checkpoint(checkpointer, orphan_thread)
    finally:
        await checkpointer.adelete_thread(str(orphan_thread))


async def test_purge_uses_checkpoint_timestamps_not_id_order(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    orphan_thread = uuid.uuid4()
    now = datetime.now(UTC)
    stale_id = "ffffffff-ffff-6fff-8fff-ffffffffffff"
    recent_id = "00000000-0000-6000-8000-000000000000"

    try:
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=owner,
            ts=now - timedelta(days=8),
            checkpoint_id=stale_id,
        )
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=owner,
            ts=now - timedelta(hours=1),
            checkpoint_id=recent_id,
        )

        deleted = await purge_expired_chat_threads(
            settings=Settings(
                chat_retention_days=7,
                chat_orphan_min_age_hours=24,
            ),
            checkpointer=checkpointer,
            now=now,
        )

        assert deleted == 0
        assert await _has_specific_checkpoint(
            checkpointer, orphan_thread, stale_id
        )
        assert await _has_specific_checkpoint(
            checkpointer, orphan_thread, recent_id
        )
    finally:
        await checkpointer.adelete_thread(str(orphan_thread))


async def test_purge_preserves_orphan_with_conflicting_picker_owners(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    stranger = f"picker-{uuid.uuid4().hex}"
    orphan_thread = uuid.uuid4()
    now = datetime.now(UTC)
    first_id = "00000000-0000-6000-8000-000000000001"
    second_id = "00000000-0000-6000-8000-000000000002"

    try:
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=owner,
            ts=now - timedelta(days=8),
            checkpoint_id=first_id,
        )
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=stranger,
            ts=now - timedelta(days=9),
            checkpoint_id=second_id,
        )

        deleted = await purge_expired_chat_threads(
            settings=Settings(
                chat_retention_days=7,
                chat_orphan_min_age_hours=24,
            ),
            checkpointer=checkpointer,
            now=now,
        )

        assert deleted == 0
        assert await _has_specific_checkpoint(
            checkpointer, orphan_thread, first_id
        )
        assert await _has_specific_checkpoint(
            checkpointer, orphan_thread, second_id
        )
    finally:
        await checkpointer.adelete_thread(str(orphan_thread))


async def test_purge_preserves_orphan_when_any_timestamp_is_unknown(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    orphan_thread = uuid.uuid4()
    now = datetime.now(UTC)
    stale_id = "ffffffff-ffff-6fff-8fff-ffffffffffff"
    unreadable_id = "00000000-0000-6000-8000-000000000000"

    try:
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=owner,
            ts=now - timedelta(days=8),
            checkpoint_id=stale_id,
        )
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=owner,
            ts="not-a-timestamp",
            checkpoint_id=unreadable_id,
        )

        deleted = await purge_expired_chat_threads(
            settings=Settings(
                chat_retention_days=7,
                chat_orphan_min_age_hours=24,
            ),
            checkpointer=checkpointer,
            now=now,
        )

        assert deleted == 0
        assert await _has_specific_checkpoint(
            checkpointer, orphan_thread, stale_id
        )
        assert await _has_specific_checkpoint(
            checkpointer, orphan_thread, unreadable_id
        )
    finally:
        await checkpointer.adelete_thread(str(orphan_thread))


async def test_checkpoint_thread_evidence_requires_uniform_owner_and_timestamps(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    stranger = f"picker-{uuid.uuid4().hex}"
    mixed_owner_thread = uuid.uuid4()
    unreadable_thread = uuid.uuid4()
    absent_thread = uuid.uuid4()
    now = datetime.now(UTC)

    try:
        await _put_checkpoint(
            checkpointer,
            mixed_owner_thread,
            picker_id=owner,
            ts=now - timedelta(days=8),
        )
        await _put_checkpoint(
            checkpointer,
            mixed_owner_thread,
            picker_id=stranger,
            ts=now - timedelta(days=9),
        )
        await _put_checkpoint(
            checkpointer,
            unreadable_thread,
            picker_id=owner,
            ts=now - timedelta(days=8),
        )
        await _put_checkpoint(
            checkpointer,
            unreadable_thread,
            picker_id=owner,
            ts="not-a-timestamp",
        )

        async with SessionLocal() as session:
            mixed = await checkpoint_thread_evidence(
                session, thread_id=str(mixed_owner_thread)
            )
            unreadable = await checkpoint_thread_evidence(
                session, thread_id=str(unreadable_thread)
            )
            absent = await checkpoint_thread_evidence(
                session, thread_id=str(absent_thread)
            )

        assert mixed is not None
        assert mixed.last_activity is not None
        assert mixed.picker_id is None
        assert unreadable is not None
        assert unreadable.last_activity is None
        assert unreadable.picker_id == owner
        assert absent is None
    finally:
        for thread_id in (mixed_owner_thread, unreadable_thread, absent_thread):
            await checkpointer.adelete_thread(str(thread_id))


async def test_purge_preserves_orphan_that_gains_a_thread_row_after_discovery(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    checkpointer, _ = postgres_storage
    picker_id = f"picker-{uuid.uuid4().hex}"
    orphan_thread = uuid.uuid4()
    now = datetime.now(UTC)

    async def discovered_orphan(*_args: Any, **_kwargs: Any) -> list[str]:
        return [str(orphan_thread)]

    try:
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=picker_id,
            ts=now - timedelta(days=8),
        )
        monkeypatch.setattr(
            retention_module,
            "list_orphan_checkpoint_thread_ids",
            discovered_orphan,
        )

        async with SessionLocal() as session:
            thread = ChatThread(id=orphan_thread, user_id=picker_id, title="late")
            thread.created_at = now
            thread.updated_at = now
            session.add(thread)
            await session.commit()

        deleted = await purge_expired_chat_threads(
            settings=Settings(
                chat_retention_days=7,
                chat_orphan_min_age_hours=24,
            ),
            checkpointer=checkpointer,
            now=now,
        )

        assert deleted == 0
        assert await _has_checkpoint(checkpointer, orphan_thread)
    finally:
        await checkpointer.adelete_thread(str(orphan_thread))
        await _cleanup([picker_id])


async def test_purge_preserves_orphan_with_new_checkpoint_after_discovery(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    checkpointer, _ = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    orphan_thread = uuid.uuid4()
    now = datetime.now(UTC)

    async def discovered_orphan(*_args: Any, **_kwargs: Any) -> list[str]:
        return [str(orphan_thread)]

    try:
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=owner,
            ts=now - timedelta(days=8),
        )
        monkeypatch.setattr(
            retention_module,
            "list_orphan_checkpoint_thread_ids",
            discovered_orphan,
        )
        await _put_checkpoint(
            checkpointer,
            orphan_thread,
            picker_id=owner,
            ts=now - timedelta(hours=1),
        )

        deleted = await purge_expired_chat_threads(
            settings=Settings(
                chat_retention_days=7,
                chat_orphan_min_age_hours=24,
            ),
            checkpointer=checkpointer,
            now=now,
        )

        assert deleted == 0
        assert await _has_checkpoint(checkpointer, orphan_thread)
    finally:
        await checkpointer.adelete_thread(str(orphan_thread))


async def test_purge_continues_after_orphan_deletion_failure_and_retries(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    owner = f"picker-{uuid.uuid4().hex}"
    failing_thread = uuid.uuid4()
    safe_thread = uuid.uuid4()
    now = datetime.now(UTC)
    old_ts = now - timedelta(days=8)

    try:
        await _put_checkpoint(
            checkpointer,
            failing_thread,
            picker_id=owner,
            ts=old_ts,
        )
        await _put_checkpoint(
            checkpointer,
            safe_thread,
            picker_id=owner,
            ts=old_ts,
        )
        flaky = SelectiveFailCheckpointer(checkpointer, str(failing_thread))
        settings = Settings(
            chat_retention_days=7,
            chat_orphan_min_age_hours=24,
        )

        first = await purge_expired_chat_threads(
            settings=settings,
            checkpointer=flaky,  # type: ignore[arg-type]
            now=now,
        )

        assert first == 1
        assert await _has_checkpoint(checkpointer, failing_thread)
        assert not await _has_checkpoint(checkpointer, safe_thread)

        second = await purge_expired_chat_threads(
            settings=settings,
            checkpointer=checkpointer,
            now=now,
        )
        assert second == 1
        assert not await _has_checkpoint(checkpointer, failing_thread)

        third = await purge_expired_chat_threads(
            settings=settings,
            checkpointer=checkpointer,
            now=now,
        )
        assert third == 0
    finally:
        await checkpointer.adelete_thread(str(failing_thread))
        await checkpointer.adelete_thread(str(safe_thread))


async def test_purge_is_disabled_when_retention_is_zero(
    postgres_storage: tuple[AsyncPostgresSaver, AsyncPostgresStore],
) -> None:
    checkpointer, _ = postgres_storage
    picker_id = f"picker-{uuid.uuid4().hex}"

    try:
        async with SessionLocal() as session:
            thread = await _create_thread(
                session,
                picker_id=picker_id,
                updated_at=datetime.now(UTC) - timedelta(days=30),
            )

        deleted = await purge_expired_chat_threads(
            settings=Settings(chat_retention_days=0),
        )

        async with SessionLocal() as session:
            assert await session.get(ChatThread, thread.id) is not None
        assert deleted == 0
    finally:
        await _cleanup([picker_id])



@asynccontextmanager
async def api_client(
    *,
    user: ClerkUser,
    checkpointer: FakeCheckpointer,
    store: FakeStore,
) -> AsyncIterator[AsyncClient]:
    async def real_session() -> AsyncIterator[Any]:
        async with SessionLocal() as session:
            yield session

    app.dependency_overrides[require_auth] = lambda: user
    app.dependency_overrides[get_checkpointer] = lambda: checkpointer
    app.dependency_overrides[get_memory_store] = lambda: store
    app.dependency_overrides[get_session] = real_session
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


async def test_account_data_endpoint_returns_counts_for_the_authenticated_user(
    postgres_db: None,
) -> None:
    owner = f"picker-{uuid.uuid4().hex}"
    user = ClerkUser(user_id=owner, session_id="sess", claims={})
    checkpointer = FakeCheckpointer()
    store = FakeStore()
    store.items[memory_namespace(owner)] = {
        "/memories/notes.md": {"content": RAW_TEXT},
    }

    try:
        async with SessionLocal() as session:
            thread = await _create_thread(session, picker_id=owner)
            report = await _create_report(
                session,
                picker_id=owner,
                source_thread_id=thread.id,
            )

        async with api_client(
            user=user,
            checkpointer=checkpointer,
            store=store,
        ) as client:
            response = await client.delete("/api/v1/account/data")

        assert response.status_code == 200
        assert response.json() == {
            "status": "completed",
            "reports_deleted": 1,
            "threads_deleted": 1,
            "memory_items_deleted": 1,
        }
        assert checkpointer.deleted == [str(thread.id)]
        async with SessionLocal() as session:
            assert await session.get(Report, report.id) is None
            assert await session.get(ChatThread, thread.id) is None
    finally:
        await _cleanup([owner])


async def test_report_delete_endpoint_hides_foreign_reports(
    postgres_db: None,
) -> None:
    owner = f"picker-{uuid.uuid4().hex}"
    attacker = f"picker-{uuid.uuid4().hex}"
    user = ClerkUser(user_id=attacker, session_id="sess", claims={})
    checkpointer = FakeCheckpointer()

    try:
        async with SessionLocal() as session:
            thread = await _create_thread(session, picker_id=owner)
            report = await _create_report(
                session,
                picker_id=owner,
                source_thread_id=thread.id,
            )

        async with api_client(
            user=user,
            checkpointer=checkpointer,
            store=FakeStore(),
        ) as client:
            response = await client.delete(f"/api/v1/reports/{report.id}")

        assert response.status_code == 404
        assert checkpointer.deleted == []
        async with SessionLocal() as session:
            assert await session.get(Report, report.id) is not None
            assert await session.get(ChatThread, thread.id) is not None
    finally:
        await _cleanup([owner, attacker])


async def test_report_delete_endpoint_returns_503_when_history_cannot_be_removed(
    postgres_db: None,
) -> None:
    owner = f"picker-{uuid.uuid4().hex}"
    user = ClerkUser(user_id=owner, session_id="sess", claims={})
    checkpointer = FakeCheckpointer()
    checkpointer.fail = True

    try:
        async with SessionLocal() as session:
            thread = await _create_thread(session, picker_id=owner)
            report = await _create_report(
                session,
                picker_id=owner,
                source_thread_id=thread.id,
            )

        async with api_client(
            user=user,
            checkpointer=checkpointer,
            store=FakeStore(),
        ) as client:
            response = await client.delete(f"/api/v1/reports/{report.id}")

        assert response.status_code == 503
        async with SessionLocal() as session:
            assert await session.get(Report, report.id) is not None
            assert await session.get(ChatThread, thread.id) is not None
    finally:
        await _cleanup([owner])
