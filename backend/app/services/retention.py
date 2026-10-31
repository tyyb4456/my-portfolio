"""Operator-invoked retention cleanup for chat threads.

No scheduler is installed by this repository. Deployment must run this module
periodically when ``CHAT_RETENTION_DAYS`` is greater than zero. Report rows,
report raw text, and long-term memory are deliberately not given automatic
expiry here; those require separate policy decisions (see
``SECURITY_AND_PRIVACY.md``).

The cleanup removes expired chat checkpoints and the matching ``chat_threads``
row together. It never deletes reports, which remain independent of the
conversation that produced them.
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
    """Delete threads whose last activity is older than the configured cutoff.

    Returns the number of deleted thread rows. Checkpoints are deleted before
    the database row; a failure leaves the row in place for a safe retry.
    """
    resolved = settings or get_settings()
    if resolved.chat_retention_days <= 0:
        return 0

    evaluated_at = now or datetime.now(UTC)
    cutoff = evaluated_at - timedelta(days=resolved.chat_retention_days)

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

    if not thread_ids:
        return 0

    pool: AsyncConnectionPool[AsyncConnection[dict[str, Any]]] | None = None
    saver = checkpointer
    if saver is None:
        pool, saver = await _open_checkpointer(resolved)

    deleted = 0
    try:
        for thread_id in thread_ids:
            await saver.adelete_thread(str(thread_id))
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
            deleted += max(result.rowcount or 0, 0)
    finally:
        if pool is not None:
            await pool.close()

    return deleted


async def _main() -> None:
    deleted = await purge_expired_chat_threads()
    logger.info("Deleted %d expired chat threads", deleted)


if __name__ == "__main__":  # pragma: no cover - operational entry point
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(_main())
