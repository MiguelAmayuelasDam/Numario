"""split var/fija por grupo; el grupo pesa sobre el total (fin del split global)

El grupo pasa a ser el contenedor de más alto nivel (un bróker), con su propio
split renta variable/fija. Se elimina el reparto global (investment_allocations) y
la clase del grupo (asset_class): la clase ahora es una etiqueta del activo.

Revision ID: 0014_investment_group_split
Revises: 0013_investment_groups
Create Date: 2026-08-03
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0014_investment_group_split"
down_revision: str | None = "0013_investment_groups"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Split interno del grupo. Por defecto 100/0 (grupo todo variable).
    op.add_column(
        "investment_groups",
        sa.Column(
            "variable_pct",
            sa.Numeric(precision=6, scale=2),
            nullable=False,
            server_default="100",
        ),
    )
    op.add_column(
        "investment_groups",
        sa.Column(
            "fixed_pct", sa.Numeric(precision=6, scale=2), nullable=False, server_default="0"
        ),
    )
    # Traslada la clase heredada del grupo a su split: un grupo que era 'fija'
    # pasa a 0/100; el resto (variable) se queda en 100/0 (el default).
    op.execute(
        "UPDATE investment_groups SET variable_pct = 0, fixed_pct = 100 "
        "WHERE asset_class = 'fija'"
    )
    op.drop_column("investment_groups", "asset_class")

    # Fin del reparto global entre clases: ahora cada grupo lleva el suyo.
    op.drop_table("investment_allocations")


def downgrade() -> None:
    op.create_table(
        "investment_allocations",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variable_pct", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("fixed_pct", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.add_column(
        "investment_groups",
        sa.Column(
            "asset_class", sa.String(length=10), nullable=False, server_default="variable"
        ),
    )
    op.execute(
        "UPDATE investment_groups SET asset_class = 'fija' WHERE fixed_pct > variable_pct"
    )
    op.drop_column("investment_groups", "fixed_pct")
    op.drop_column("investment_groups", "variable_pct")
