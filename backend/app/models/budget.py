"""Modelo Budget.

Configuración financiera del usuario (una fila por usuario): ingreso mensual y el
reparto 50-30-20 **configurable** (los porcentajes de Vida/Mes/Inversión deben
sumar 100; por defecto 50/30/20).
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    monthly_income: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0")
    )
    living_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    monthly_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    investment_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
