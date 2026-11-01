"""User-scoped deletion of individual reports.

Deleting a report is a hard deletion. The row's numeric observation therefore
stops contributing to future price estimates and trusted anomaly baselines; past
estimates are never rewritten because they are not persisted aggregates.

A report also records the chat thread that produced it. A thread may contain
several reports, so report deletion removes the thread's LangGraph checkpoints
and ``chat_threads`` metadata only when no other report still references that
thread. Shared conversations are kept so deleting one report cannot erase
another report's history. Long-term memory items have the exact raw message
redacted from them, leaving unrelated notes intact. Other reports and other
users' data are never touched. Legacy rows without a source thread keep their
chat history; account-data erasure removes all owned threads.
"""

from __future__ import annotations

import logging
import uuid

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.store.base import BaseStore
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_thread import ChatThread
from app.models.report import Report
from app.services.chat_memory import redact_memory_items_containing

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

    The source thread is deleted only when this is its last remaining report.
    The thread row is locked while that decision is made so two concurrent
    deletions cannot both decide the thread is unused and tear it down twice.

    External stores are cleared first. If any of them fails, the database
    transaction is rolled back and the error is raised, so a failure is never
    reported as a completed deletion. Retrying is safe because checkpoint
    deletion and memory redaction are idempotent.
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
    delete_thread = False

    try:
        if source_thread_id is not None:
            owner = await session.scalar(
                select(ChatThread)
                .where(ChatThread.id == source_thread_id)
                .with_for_update()
            )
            if owner is not None and owner.user_id != picker_id:
                logger.warning(
                    "Report %s references a thread owned by another user; "
                    "skipping checkpoint deletion",
                    report_id,
                )
            else:
                sibling_reports = await session.scalar(
                    select(func.count(Report.id)).where(
                        Report.source_thread_id == source_thread_id,
                        Report.id != report_id,
                    )
                )
                if sibling_reports:
                    logger.info(
                        "Keeping shared chat thread %s: %d other report(s) still "
                        "reference it",
                        source_thread_id,
                        sibling_reports,
                    )
                else:
                    delete_thread = True
                    await checkpointer.adelete_thread(str(source_thread_id))

        await redact_memory_items_containing(
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
        if delete_thread and source_thread_id is not None:
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
