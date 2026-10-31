"""Account-level erasure of application-managed data.

This is not the same as deleting a thread, deleting saved notes, or deleting a
single report. It removes every report, thread, checkpoint, and long-term memory
item owned by the authenticated Clerk user. It does not delete the Clerk account
or data outside this application (logs, backups, model-provider copies).
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.chat import get_checkpointer, get_memory_store
from app.auth import ClerkUser, require_auth
from app.db.session import get_session
from app.schemas.account import AccountDataErasureResponse
from app.services.account_erasure import AccountErasureIncomplete, erase_account_data

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/account", tags=["account"])


@router.delete(
    "/data",
    response_model=AccountDataErasureResponse,
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Missing or invalid Clerk session"},
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Erasure did not complete and may be retried"
        },
    },
)
async def delete_account_data(
    user: Annotated[ClerkUser, Depends(require_auth)],
    session: Annotated[AsyncSession, Depends(get_session)],
    checkpointer: Annotated[Any, Depends(get_checkpointer)],
    store: Annotated[Any, Depends(get_memory_store)],
) -> AccountDataErasureResponse:
    """Erase all application-managed data for the signed-in picker.

    The response is returned only after checkpoint, memory, and database
    deletion all succeed. A failure returns ``503`` with a retry instruction;
    it never returns a partial result as success. Retrying is safe.
    """
    try:
        result = await erase_account_data(
            session,
            picker_id=user.user_id,
            checkpointer=checkpointer,
            store=store,
        )
    except AccountErasureIncomplete as exc:
        logger.exception("Account data erasure failed during %s", exc.stage)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Account data erasure did not complete "
                f"(failed during {exc.stage}); please retry"
            ),
        ) from None
    except SQLAlchemyError:
        logger.exception("Account data erasure database operation failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account data erasure did not complete; please retry",
        ) from None

    return AccountDataErasureResponse(
        reports_deleted=result.reports_deleted,
        threads_deleted=result.threads_deleted,
        memory_items_deleted=result.memory_items_deleted,
    )
