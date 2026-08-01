"""Modelo InvestmentAllocation (reparto entre clases de la cartera).

El primer nivel del reparto: qué porcentaje de la aportación mensual va a renta
**variable** y cuánto a renta **fija**. Los dos suman 100. Una fila por usuario.

El segundo nivel —el peso de cada activo dentro de su clase— vive en `Asset`.
"""

import uuid

from sqlalchemy import ForeignKey, Integer, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InvestmentAllocation(Base):
    __tablename__ = "investment_allocations"

    # PK = user_id: una sola configuración de reparto por usuario.
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    variable_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    fixed_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
