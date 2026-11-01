"""Read-only discovery of LangGraph checkpoint threads.

The checkpointer owns its own tables rather than an application model, but it
uses the same PostgreSQL database as the application. These helpers let the
deletion paths find checkpoint threads that have no ``chat_threads`` row, so a
retention sweep or an account erasure cannot leave them behind forever.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_CHECKPOINTS_EXIST = text("SELECT to_regclass('public.checkpoints')")

_PICKER_THREAD_IDS = text(
    """
    SELECT DISTINCT c.thread_id
    FROM checkpoints AS c
    LEFT JOIN chat_threads AS t ON t.id::text = c.thread_id
    WHERE c.metadata ->> 'picker_id' = :picker_id
      AND (t.id IS NULL OR t.user_id = :picker_id)
    ORDER BY c.thread_id
    """
)

_ORPHAN_THREAD_IDS = text(
    """
    SELECT DISTINCT c.thread_id
    FROM checkpoints AS c
    LEFT JOIN chat_threads AS t ON t.id::text = c.thread_id
    WHERE t.id IS NULL
    ORDER BY c.thread_id
    LIMIT :limit
    """
)

_THREAD_IS_ORPHAN = text(
    """
    SELECT NOT EXISTS (
        SELECT 1 FROM chat_threads WHERE id::text = :thread_id
    )
    """
)


async def checkpoints_available(session: AsyncSession) -> bool:
    """Return whether the checkpointer has created its tables yet."""
    return await session.scalar(_CHECKPOINTS_EXIST) is not None


async def list_picker_checkpoint_thread_ids(
    session: AsyncSession,
    *,
    picker_id: str,
) -> list[str]:
    """Return checkpoint thread ids attributed to ``picker_id`` by metadata.

    Only threads whose checkpoint metadata contains the authenticated picker id
    are returned, and a thread that has a ``chat_threads`` row owned by a
    different user is excluded. Legacy or unattributed checkpoints are never
    included, so an erasure cannot delete data it cannot prove belongs to the
    requester.
    """
    if not await checkpoints_available(session):
        return []
    return list(
        (
            await session.scalars(
                _PICKER_THREAD_IDS, {"picker_id": picker_id}
            )
        ).all()
    )


async def list_orphan_checkpoint_thread_ids(
    session: AsyncSession,
    *,
    limit: int,
) -> list[str]:
    """Return checkpoint thread ids with no matching ``chat_threads`` row.

    These threads cannot be opened through the application because thread
    ownership is checked against ``chat_threads``. They are leftovers from
    earlier writes, failed deletions, or legacy data and must not exempt
    themselves from retention.
    """
    if not await checkpoints_available(session):
        return []
    return list(
        (
            await session.scalars(_ORPHAN_THREAD_IDS, {"limit": limit})
        ).all()
    )


async def is_orphan_checkpoint_thread(
    session: AsyncSession,
    *,
    thread_id: str,
) -> bool:
    """Return whether ``thread_id`` still has no ``chat_threads`` row."""
    if not await checkpoints_available(session):
        return False
    return bool(
        await session.scalar(_THREAD_IS_ORPHAN, {"thread_id": thread_id})
    )
