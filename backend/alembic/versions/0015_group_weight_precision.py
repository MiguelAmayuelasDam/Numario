"""más precisión en el peso del grupo (proporción del total en 8 decimales)

El peso del grupo se elige en euros del total del mes y se guarda como proporción.
Con 2 decimales, 1000 € de 1500 € = 66,67% reconstruía 1000,05 € (y ese error se
colaba en el reparto). Con 8 decimales el euro cuadra al céntimo.

Revision ID: 0015_group_weight_precision
Revises: 0014_investment_group_split
Create Date: 2026-08-03
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0015_group_weight_precision"
down_revision: str | None = "0014_investment_group_split"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "investment_groups",
        "weight",
        type_=sa.Numeric(precision=11, scale=8),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "investment_groups",
        "weight",
        type_=sa.Numeric(precision=6, scale=2),
        existing_nullable=False,
    )
