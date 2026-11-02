"""Read-only discovery of LangGraph checkpoint threads.

The checkpointer owns its own tables rather than an application model, but it
uses the same PostgreSQL database as the application. These helpers let the
deletion paths find checkpoint threads that have no ``chat_threads`` row, so a
retention sweep or an account erasure cannot leave them behind forever.

A missing ``chat_threads`` row does not by itself prove that a checkpoint thread
is stale. A checkpoint can be written while a thread is being created or torn
down, and a failed application write can leave a recent thread behind. Orphan
cleanup therefore also requires trustworthy evidence for the whole thread: every
checkpoint must have a parseable ``checkpoints.checkpoint->>'ts'`` and the same
explicit ``metadata->>'picker_id'``. When any timestamp or owner is missing,
unreadable, or conflicting, the thread is preserved.

``checkpoint.ts`` is the authoritative wall-clock time. The checkpoint id is not
used for ordering because LangGraph generates UUIDv6 ids but its storage API
accepts arbitrary ids from direct writers.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

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

# Deletion needs positive evidence for the whole thread, not just its newest
# row: every checkpoint must have a parseable timestamp and the same explicit
# picker attribution. ``checkpoint.ts`` is the authoritative wall-clock time.
# Ordering by ``checkpoint_id`` is not safe because direct writers can supply
# arbitrary ids even though LangGraph itself generates UUIDv6 values.
_ORPHAN_THREAD_IDS = text(
    """
    WITH parsed AS (
        SELECT
            c.thread_id,
            NULLIF(c.metadata ->> 'picker_id', '') AS picker_id,
            pg_input_is_valid(
                c.checkpoint ->> 'ts', 'timestamptz'
            ) AS ts_ok,
            CASE
                WHEN pg_input_is_valid(
                    c.checkpoint ->> 'ts', 'timestamptz'
                )
                THEN (c.checkpoint ->> 'ts')::timestamptz
            END AS ts
        FROM checkpoints AS c
        LEFT JOIN chat_threads AS t ON t.id::text = c.thread_id
        WHERE t.id IS NULL
    ),
    evidence AS (
        SELECT
            thread_id,
            CASE WHEN bool_and(ts_ok IS TRUE) THEN max(ts) END
                AS last_activity,
            CASE
                WHEN count(DISTINCT picker_id) = 1
                 AND count(*) FILTER (WHERE picker_id IS NULL) = 0
                THEN min(picker_id)
            END AS picker_id
        FROM parsed
        GROUP BY thread_id
    )
    SELECT thread_id
    FROM evidence
    WHERE last_activity IS NOT NULL
      AND picker_id IS NOT NULL
      AND last_activity < :older_than
    ORDER BY thread_id
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

# Mirrors _ORPHAN_THREAD_IDS for a single thread. It aggregates every row so a
# recent write or any unreadable/conflicting metadata preserves the thread. The
# HAVING clause keeps "no checkpoints" distinguishable from "unusable evidence".
_THREAD_EVIDENCE = text(
    """
    WITH parsed AS (
        SELECT
            NULLIF(c.metadata ->> 'picker_id', '') AS picker_id,
            pg_input_is_valid(
                c.checkpoint ->> 'ts', 'timestamptz'
            ) AS ts_ok,
            CASE
                WHEN pg_input_is_valid(
                    c.checkpoint ->> 'ts', 'timestamptz'
                )
                THEN (c.checkpoint ->> 'ts')::timestamptz
            END AS ts
        FROM checkpoints AS c
        WHERE c.thread_id = :thread_id
    )
    SELECT
        CASE WHEN bool_and(ts_ok IS TRUE) THEN max(ts) END
            AS last_activity,
        CASE
            WHEN count(DISTINCT picker_id) = 1
             AND count(*) FILTER (WHERE picker_id IS NULL) = 0
            THEN min(picker_id)
        END AS picker_id
    FROM parsed
    HAVING count(*) > 0
    """
)


@dataclass(frozen=True)
class CheckpointThreadEvidence:
    """Whole-thread activity time and explicit picker attribution."""

    last_activity: datetime | None
    picker_id: str | None


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
    older_than: datetime,
) -> list[str]:
    """Return orphan thread ids with uniformly old, attributable checkpoints.

    A thread is an orphan only when it has no ``chat_threads`` row. It is
    returned only when every checkpoint has a parseable timestamp, the latest
    of those timestamps predates ``older_than``, and every checkpoint carries
    the same non-empty picker id. Threads with a missing or invalid timestamp,
    a missing owner, or conflicting owners are deliberately excluded so unknown
    metadata can never make data look stale or unsafe to remove.
    """
    if not await checkpoints_available(session):
        return []
    return list(
        (
            await session.scalars(
                _ORPHAN_THREAD_IDS,
                {"limit": limit, "older_than": older_than},
            )
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


async def checkpoint_thread_evidence(
    session: AsyncSession,
    *,
    thread_id: str,
) -> CheckpointThreadEvidence | None:
    """Return whole-thread activity and ownership evidence.

    ``None`` means the thread has no checkpoints or the checkpointer tables do
    not exist. A missing ``last_activity`` means at least one checkpoint
    timestamp is missing or unreadable. A missing ``picker_id`` means ownership
    is unknown (a checkpoint has no owner) or conflicting (multiple owners).
    Callers must preserve the thread in either case rather than assuming it is
    old or safe to remove.
    """
    if not await checkpoints_available(session):
        return None
    row = (
        await session.execute(_THREAD_EVIDENCE, {"thread_id": thread_id})
    ).one_or_none()
    if row is None:
        return None
    return CheckpointThreadEvidence(
        last_activity=row[0],
        picker_id=row[1],
    )
