"""Modelo InvestmentGroup (grupo de activos dentro de una clase).

El nivel intermedio del reparto de tres niveles: dentro de una clase (variable /
fija) puedes agrupar activos —por ejemplo "Crecimiento" y "Dividendos" dentro de
renta variable— y darle un peso a cada grupo (% de la clase). Los grupos de una
misma clase suman 100. Los activos cuelgan de un grupo o directamente de la clase.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InvestmentGroup(Base):
    __tablename__ = "investment_groups"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    asset_class: Mapped[str] = mapped_column(String(10), nullable=False)  # variable | fija
    # Peso del grupo dentro de su clase; los grupos de una clase suman 100.
    weight: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal(0))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
