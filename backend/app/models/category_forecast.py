"""Modelo CategoryForecast (previsto mensual por categoría).

Presupuesto recurrente que el usuario asigna a una categoría para el mes en
curso; se compara con lo gastado (Gastado vs Previsto). Uno por (usuario,
categoría).
"""

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CategoryForecast(Base):
    __tablename__ = "category_forecasts"
    __table_args__ = (
        UniqueConstraint("user_id", "category_id", name="uq_category_forecasts_user_category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("categories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
