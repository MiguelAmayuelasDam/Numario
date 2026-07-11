"""create classification_rules table

Revision ID: 0006_create_classification_rules
Revises: 0005_create_transactions
Create Date: 2026-07-11
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0006_create_classification_rules"
down_revision: str | None = "0005_create_transactions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "classification_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("keyword", sa.String(length=120), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "keyword", name="uq_classification_rules_user_keyword"),
    )
    op.create_index(
        op.f("ix_classification_rules_user_id"), "classification_rules", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_classification_rules_category_id"),
        "classification_rules",
        ["category_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_classification_rules_category_id"), table_name="classification_rules")
    op.drop_index(op.f("ix_classification_rules_user_id"), table_name="classification_rules")
    op.drop_table("classification_rules")
