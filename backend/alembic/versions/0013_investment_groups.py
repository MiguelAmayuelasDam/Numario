"""create investment_groups + assets.group_id (tercer nivel del reparto)

Revision ID: 0013_investment_groups
Revises: 0012_investment_portfolio
Create Date: 2026-08-02
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0013_investment_groups"
down_revision: str | None = "0012_investment_portfolio"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "investment_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("asset_class", sa.String(length=10), nullable=False),
        sa.Column(
            "weight", sa.Numeric(precision=6, scale=2), nullable=False, server_default="0"
        ),
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
    op.create_index(
        op.f("ix_investment_groups_user_id"), "investment_groups", ["user_id"], unique=False
    )

    # Grupo opcional del activo. SET NULL: al borrar un grupo, sus activos pasan
    # a colgar directos de la clase (no se pierden).
    op.add_column(
        "assets",
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_assets_group_id_investment_groups"),
        "assets",
        "investment_groups",
        ["group_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_assets_group_id"), "assets", ["group_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_assets_group_id"), table_name="assets")
    op.drop_constraint(
        op.f("fk_assets_group_id_investment_groups"), "assets", type_="foreignkey"
    )
    op.drop_column("assets", "group_id")
    op.drop_index(op.f("ix_investment_groups_user_id"), table_name="investment_groups")
    op.drop_table("investment_groups")
