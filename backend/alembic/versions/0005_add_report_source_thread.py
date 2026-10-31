"""add report source thread attribution

Revision ID: 0005_add_report_source_thread
Revises: 0004_add_report_anomaly_outcome
Create Date: 2026-11-01 00:00:00.000000

Report rows keep the chat thread that produced them so an erasure request can
remove the corresponding checkpoints and thread metadata. Legacy rows have no
source thread and keep a null value; they are never guessed or backfilled.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_add_report_source_thread"
down_revision: str | None = "0004_add_report_anomaly_outcome"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "reports",
        sa.Column("source_thread_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_reports_source_thread_id"),
        "reports",
        ["source_thread_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_reports_source_thread_id"), table_name="reports")
    op.drop_column("reports", "source_thread_id")
