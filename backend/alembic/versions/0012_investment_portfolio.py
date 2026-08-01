"""create assets + investment_allocations + transactions.asset_id

Revision ID: 0012_investment_portfolio
Revises: 0011_emergency_monthly_need
Create Date: 2026-08-01
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0012_investment_portfolio"
down_revision: str | None = "0011_emergency_monthly_need"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("asset_class", sa.String(length=10), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column(
            "weight", sa.Numeric(precision=6, scale=2), nullable=False, server_default="0"
        ),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_assets_user_id"), "assets", ["user_id"], unique=False)

    op.create_table(
        "investment_allocations",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variable_pct", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("fixed_pct", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    # Un movimiento puede pertenecer a un activo (aportación). SET NULL: si se
    # borra el activo, el movimiento se conserva sin activo.
    op.add_column(
        "transactions",
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_transactions_asset_id_assets"),
        "transactions",
        "assets",
        ["asset_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_transactions_asset_id"), "transactions", ["asset_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_transactions_asset_id"), table_name="transactions")
    op.drop_constraint(
        op.f("fk_transactions_asset_id_assets"), "transactions", type_="foreignkey"
    )
    op.drop_column("transactions", "asset_id")
    op.drop_table("investment_allocations")
    op.drop_index(op.f("ix_assets_user_id"), table_name="assets")
    op.drop_table("assets")
