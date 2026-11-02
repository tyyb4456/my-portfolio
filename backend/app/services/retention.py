"""Operator-invoked retention cleanup for chat threads.

No scheduler is installed by this repository. Deployment must run this module
periodically when ``CHAT_RETENTION_DAYS`` is greater than zero. Report rows,
report raw text, and long-term memory are deliberately not given automatic
expiry here; those require separate policy decisions (see
``SECURITY_AND_PRIVACY.md``).

The cleanup removes expired chat checkpoints and the matching ``chat_threads``
row together. It also removes orphan checkpoint threads that have no
``chat_threads`` row at all: those conversations cannot be opened by any picker
(ownership is checked against ``chat_threads``), so they silently outlive the
retention window. An orphan is removed only when it still has no thread row at
the moment of deletion, every checkpoint is older than
``CHAT_ORPHAN_MIN_AGE_HOURS``, and every checkpoint carries the same explicit
picker attribution. Missing or unreadable timestamps and unknown or conflicting
ownership are preserved. It never deletes reports, which remain independent of
the conversation that produced them.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from sqlalchemy import delete, select
from sqlalchemy.engine import CursorResult

from app.core.config import Settings, get_settings
from app.db.session import SessionLocal
from app.models.chat_thread import ChatThread
from app.services.checkpoint_threads import (
    checkpoint_thread_evidence,
    is_orphan_checkpoint_thread,
    list_orphan_checkpoint_thread_ids,
)

logger = logging.getLogger(__name__)


async def _open_checkpointer(
    settings: Settings,
) -> tuple[AsyncConnectionPool[AsyncConnection[dict[str, Any]]], AsyncPostgresSaver]:
    """Open a dedicated checkpointer pool without building the LLM agent."""
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
    except BaseException:
        await pool.close()
        raise
    return pool, checkpointer


async def purge_expired_chat_threads(
    *,
    settings: Settings | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    now: datetime | None = None,
    limit: int = 1000,
) -> int:
    """Delete expired thread rows and stale orphan checkpoint threads.

    Returns the number of threads successfully removed (expired
    ``chat_threads`` rows plus orphan checkpoint threads). Checkpoints are
    deleted before the database row; a failure leaves the row in place for a
    safe retry. A failure for one candidate is logged and does not prevent other
    candidates from being processed.

    An orphan is deleted only when it still has no ``chat_threads`` row, every
    checkpoint is older than ``chat_orphan_min_age_hours``, and every checkpoint
    carries the same explicit picker id. The checks are repeated immediately
    before deletion to narrow the window in which a thread creation or
    checkpoint write can race the sweep.

    This remains a check-then-delete sequence: a writer can still commit after
    the final evidence read and before ``adelete_thread`` runs. Keep the orphan
    minimum age conservative and run this only as an operator-controlled
    maintenance task.
    """
    resolved = settings or get_settings()
    if resolved.chat_retention_days <= 0:
        return 0

    evaluated_at = now or datetime.now(UTC)
    cutoff = evaluated_at - timedelta(days=resolved.chat_retention_days)
    orphan_cutoff = evaluated_at - timedelta(
        hours=resolved.chat_orphan_min_age_hours
    )

    async with SessionLocal() as session:
        thread_ids = list(
            (
                await session.scalars(
                    select(ChatThread.id)
                    .where(ChatThread.updated_at < cutoff)
                    .order_by(ChatThread.updated_at.asc(), ChatThread.id.asc())
                    .limit(limit)
                )
            ).all()
        )
        orphan_thread_ids = await list_orphan_checkpoint_thread_ids(
            session,
            limit=limit,
            older_than=orphan_cutoff,
        )

    if not thread_ids and not orphan_thread_ids:
        return 0

    pool: AsyncConnectionPool[AsyncConnection[dict[str, Any]]] | None = None
    saver = checkpointer
    if saver is None:
        pool, saver = await _open_checkpointer(resolved)

    deleted = 0
    failed = 0
    preserved = 0
    try:
        for thread_id in thread_ids:
            try:
                await saver.adelete_thread(str(thread_id))
            except Exception as exc:
                failed += 1
                logger.warning(
                    "Could not delete checkpoints for expired thread %s (%s); "
                    "leaving it for a later retry",
                    thread_id,
                    type(exc).__name__,
                )
                continue

            try:
                async with SessionLocal() as session:
                    result = cast(
                        CursorResult[Any],
                        await session.execute(
                            delete(ChatThread).where(
                                ChatThread.id == thread_id,
                                ChatThread.updated_at < cutoff,
                            )
                        ),
                    )
                    await session.commit()
            except Exception as exc:
                failed += 1
                logger.warning(
                    "Could not delete expired thread row %s (%s); its "
                    "checkpoints are already gone and the row can be retried",
                    thread_id,
                    type(exc).__name__,
                )
                continue
            deleted += max(result.rowcount or 0, 0)

        for orphan_id in orphan_thread_ids:
            try:
                async with SessionLocal() as session:
                    still_orphan = await is_orphan_checkpoint_thread(
                        session,
                        thread_id=orphan_id,
                    )
                    evidence = (
                        await checkpoint_thread_evidence(
                            session,
                            thread_id=orphan_id,
                        )
                        if still_orphan
                        else None
                    )
            except Exception as exc:
                failed += 1
                logger.warning(
                    "Could not recheck orphan checkpoint thread %s (%s); "
                    "leaving it in place",
                    orphan_id,
                    type(exc).__name__,
                )
                continue

            if not still_orphan:
                logger.info(
                    "Skipping checkpoint thread %s: a chat_threads row now exists",
                    orphan_id,
                )
                continue
            if evidence is None or evidence.picker_id is None:
                preserved += 1
                logger.warning(
                    "Skipping orphan checkpoint thread %s: its checkpoints do "
                    "not share a single explicit picker attribution, so "
                    "ownership and safety cannot be established",
                    orphan_id,
                )
                continue
            if evidence.last_activity is None:
                preserved += 1
                logger.warning(
                    "Skipping orphan checkpoint thread %s: at least one "
                    "checkpoint timestamp is missing or unreadable, so it "
                    "cannot be proven stale",
                    orphan_id,
                )
                continue
            if evidence.last_activity >= orphan_cutoff:
                logger.info(
                    "Skipping orphan checkpoint thread %s: its latest "
                    "checkpoint activity is newer than the orphan minimum age",
                    orphan_id,
                )
                continue

            try:
                await saver.adelete_thread(orphan_id)
            except Exception as exc:
                failed += 1
                logger.warning(
                    "Could not delete orphan checkpoint thread %s (%s); leaving "
                    "it for a later retry",
                    orphan_id,
                    type(exc).__name__,
                )
                continue
            deleted += 1
    finally:
        if pool is not None:
            await pool.close()

    if failed:
        logger.warning(
            "Retention left %d thread(s) in place after a storage problem; a "
            "later run can retry them",
            failed,
        )
    if preserved:
        logger.warning(
            "Retention preserved %d orphan thread(s) because age or ownership "
            "could not be established",
            preserved,
        )

    return deleted


async def _main() -> None:
    deleted = await purge_expired_chat_threads()
    logger.info("Deleted %d expired chat threads", deleted)


if __name__ == "__main__":  # pragma: no cover - operational entry point
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(_main())
