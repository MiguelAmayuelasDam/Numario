"""create categories table and seed defaults

Revision ID: 0004_create_categories
Revises: 0003_add_user_nickname
Create Date: 2026-07-09
"""
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from app.db.default_categories import DEFAULT_CATEGORIES
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0004_create_categories"
down_revision: str | None = "0003_add_user_nickname"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    categories = op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("bucket", sa.String(length=20), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_categories_user_name"),
    )
    op.create_index(op.f("ix_categories_user_id"), "categories", ["user_id"], unique=False)

    # Sembrar las categorías globales por defecto (user_id NULL, is_default true).
    op.bulk_insert(
        categories,
        [
            {
                "id": uuid.uuid4(),
                "user_id": None,
                "name": name,
                "bucket": bucket,
                "emoji": emoji,
                "is_default": True,
            }
            for name, bucket, emoji in DEFAULT_CATEGORIES
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_categories_user_id"), table_name="categories")
    op.drop_table("categories")
