"""add nickname to users

Revision ID: 0003_add_user_nickname
Revises: 0002_create_refresh_tokens
Create Date: 2026-07-08
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_add_user_nickname"
down_revision: str | None = "0002_create_refresh_tokens"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1) Añadir la columna como nullable para poder backfillar filas existentes.
    op.add_column("users", sa.Column("nickname", sa.String(length=50), nullable=True))
    # 2) Backfill: valor único derivado del id (funciona con datos previos de dev).
    op.execute(
        "UPDATE users SET nickname = 'u_' || replace(id::text, '-', '') "
        "WHERE nickname IS NULL"
    )
    # 3) Fijar NOT NULL y crear el índice único.
    op.alter_column("users", "nickname", existing_type=sa.String(length=50), nullable=False)
    op.create_index(op.f("ix_users_nickname"), "users", ["nickname"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_nickname"), table_name="users")
    op.drop_column("users", "nickname")
