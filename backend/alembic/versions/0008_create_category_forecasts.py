"""create category_forecasts table

Revision ID: 0008_create_category_forecasts
Revises: 0007_create_budgets
Create Date: 2026-07-11
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0008_create_category_forecasts"
down_revision: str | None = "0007_create_budgets"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "category_forecasts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "category_id", name="uq_category_forecasts_user_category"),
    )
    op.create_index(
        op.f("ix_category_forecasts_user_id"), "category_forecasts", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_category_forecasts_category_id"),
        "category_forecasts",
        ["category_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_category_forecasts_category_id"), table_name="category_forecasts")
    op.drop_index(op.f("ix_category_forecasts_user_id"), table_name="category_forecasts")
    op.drop_table("category_forecasts")
