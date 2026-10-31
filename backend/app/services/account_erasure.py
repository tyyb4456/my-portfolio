"""Synchronous, retry-safe erasure of application-managed account data.

PostgreSQL cannot make writes to LangGraph's separate checkpointer and store
APIs atomic with the application's own tables. The order is therefore fixed:

1. delete every owned thread's LangGraph checkpoints;
2. delete the picker's complete long-term memory namespace;
3. delete report rows and thread metadata in one database transaction.

If any step fails, the database transaction is rolled back where possible and
an error is raised. The caller must not report complete erasure. Retrying is
safe because all three steps are idempotent. A new write racing the erasure can
survive; the operation should be retried.

This does not delete the Clerk identity, deployment logs, backups, or data held
by the external model provider. Those are outside this application's storage.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.store.base import BaseStore
from sqlalchemy import delete, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_thread import ChatThread
from app.models.report import Report
from app.services.chat_memory import delete_picker_memory


@dataclass(frozen=True)
class AccountErasureResult:
    """Counts for one completed erasure attempt."""

    reports_deleted: int
    threads_deleted: int
    memory_items_deleted: int


class AccountErasureIncomplete(Exception):
    """A required storage operation failed; erasure is not complete."""

    def __init__(self, stage: str) -> None:
        self.stage = stage
        super().__init__(f"Account data erasure failed during {stage}")


async def erase_account_data(
    session: AsyncSession,
    *,
    picker_id: str,
    checkpointer: BaseCheckpointSaver,
    store: BaseStore,
) -> AccountErasureResult:
    """Erase all application-managed data for one authenticated picker."""
    try:
        thread_ids = list(
            (
                await session.scalars(
                    select(ChatThread.id).where(ChatThread.user_id == picker_id)
                )
            ).all()
        )
    except Exception as exc:
        await session.rollback()
        raise AccountErasureIncomplete("database") from exc

    for thread_id in thread_ids:
        try:
            await checkpointer.adelete_thread(str(thread_id))
        except Exception as exc:
            await session.rollback()
            raise AccountErasureIncomplete("checkpoints") from exc

    try:
        memory_items_deleted = await delete_picker_memory(
            store=store,
            picker_id=picker_id,
        )
    except Exception as exc:
        await session.rollback()
        raise AccountErasureIncomplete("memory") from exc

    try:
        report_result = cast(
            CursorResult[Any],
            await session.execute(
                delete(Report).where(Report.picker_id == picker_id)
            ),
        )
        thread_result = cast(
            CursorResult[Any],
            await session.execute(
                delete(ChatThread).where(ChatThread.user_id == picker_id)
            ),
        )
        await session.commit()
    except Exception as exc:
        await session.rollback()
        raise AccountErasureIncomplete("database") from exc

    return AccountErasureResult(
        reports_deleted=max(report_result.rowcount or 0, 0),
        threads_deleted=max(thread_result.rowcount or 0, 0),
        memory_items_deleted=memory_items_deleted,
    )
