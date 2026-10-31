"""Response schema for completed account-data erasure."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class AccountDataErasureResponse(BaseModel):
    """Only returned after every required application-owned deletion succeeded."""

    status: Literal["completed"] = "completed"
    reports_deleted: int
    threads_deleted: int
    memory_items_deleted: int
