"""User-scoped deletion of individual reports.

Deleting a report is a hard deletion. The row's numeric observation therefore
stops contributing to future price estimates and trusted anomaly baselines; past
estimates are never rewritten because they are not persisted aggregates.

A report also records the chat thread that produced it. Report deletion removes
that thread's LangGraph checkpoints and ``chat_threads`` metadata so the raw
picker message is not left accessible in chat history. Long-term memory items
containing the exact raw message are removed from the same picker's namespace.
Other reports and other users' data are never touched. Legacy rows without a
source thread keep their chat history; account-data erasure removes all threads.
"""

from __future__ import annotations

import logging
import uuid

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.store.base import BaseStore
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_thread import ChatThread
from app.models.report import Report
from app.services.chat_memory import delete_memory_items_containing

logger = logging.getLogger(__name__)


class ReportDeletionStorageError(Exception):
    """A chat checkpoint or memory store could not be updated."""


async def delete_owned_report(
    session: AsyncSession,
    *,
    report_id: uuid.UUID,
    picker_id: str,
    checkpointer: BaseCheckpointSaver,
    store: BaseStore,
) -> bool:
    """Delete one report only when it belongs to ``picker_id``.

    Returns ``False`` for a nonexistent or foreign-owned report, which lets the
    route return an identical ``404`` and avoid leaking another user's report
    existence. Returns ``True`` after the database commit succeeds.

    External stores are cleared first. If any of them fails, the database
    transaction is rolled back and the error is raised, so a failure is never
    reported as a completed deletion. Retrying is safe because checkpoint and
    targeted memory deletion are idempotent.
    """
    report = await session.scalar(
        select(Report).where(
            Report.id == report_id,
            Report.picker_id == picker_id,
        )
    )
    if report is None:
        return False

    raw_text = report.raw_text
    source_thread_id = report.source_thread_id

    try:
        if source_thread_id is not None:
            owner = await session.scalar(
                select(ChatThread.user_id).where(ChatThread.id == source_thread_id)
            )
            if owner is None or owner == picker_id:
                await checkpointer.adelete_thread(str(source_thread_id))
            else:
                logger.warning(
                    "Report %s references a thread owned by another user; "
                    "skipping checkpoint deletion",
                    report_id,
                )
        await delete_memory_items_containing(
            store=store,
            picker_id=picker_id,
            text=raw_text,
        )
    except Exception as exc:
        await session.rollback()
        raise ReportDeletionStorageError(
            "Report history could not be removed"
        ) from exc

    try:
        if source_thread_id is not None:
            await session.execute(
                delete(ChatThread).where(
                    ChatThread.id == source_thread_id,
                    ChatThread.user_id == picker_id,
                )
            )
        await session.execute(
            delete(Report).where(
                Report.id == report_id,
                Report.picker_id == picker_id,
            )
        )
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    return True
