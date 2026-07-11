"""create budgets table

Revision ID: 0007_create_budgets
Revises: 0006_create_classification_rules
Create Date: 2026-07-11
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0007_create_budgets"
down_revision: str | None = "0006_create_classification_rules"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "budgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "monthly_income",
            sa.Numeric(precision=12, scale=2),
            server_default="0",
            nullable=False,
        ),
        sa.Column("living_pct", sa.Integer(), server_default="50", nullable=False),
        sa.Column("monthly_pct", sa.Integer(), server_default="30", nullable=False),
        sa.Column("investment_pct", sa.Integer(), server_default="20", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_budgets_user"),
    )


def downgrade() -> None:
    op.drop_table("budgets")
