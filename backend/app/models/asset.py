"""Modelo Asset (activo de inversión de la cartera del usuario).

Un activo es algo que genera valor económico: un ETF, un fondo, una acción,
cripto o renta fija. El reparto tiene **tres niveles**: la clase (variable/fija,
en `InvestmentAllocation`), un **grupo opcional** dentro de la clase
(`InvestmentGroup`), y el activo. El `weight` es el peso **de su padre**: del
grupo si lo tiene (`group_id`), o de la clase si cuelga directo.

No guarda ni valor de mercado ni rentabilidad: eso el usuario lo sigue en su
bróker (decisión de alcance). Aquí solo se planifican y registran las
aportaciones.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Clase del activo: cómo se comporta el riesgo. El split entre las dos lo fija
# InvestmentAllocation.
ASSET_CLASSES = ("variable", "fija")
# Tipo concreto, solo informativo/para agrupar en la interfaz.
ASSET_KINDS = ("etf", "fondo", "accion", "cripto", "otro")


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    asset_class: Mapped[str] = mapped_column(String(10), nullable=False)  # variable | fija
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # etf | fondo | ...
    # Grupo opcional dentro de la clase. Si es NULL, el activo cuelga directo de
    # la clase. SET NULL: al borrar el grupo, el activo pasa a suelto.
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("investment_groups.id", ondelete="SET NULL"), index=True, nullable=True
    )
    # Peso objetivo **dentro de su padre** (grupo o clase); los hermanos suman 100.
    weight: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal(0))
    # Archivar sin borrar: conserva el histórico de aportaciones (asset_id) intacto.
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
