"""Modelo Asset (activo de inversión de la cartera del usuario).

Un activo es algo que genera valor económico: un ETF, un fondo, una acción,
cripto o renta fija. El reparto va de arriba abajo:

    Total → Grupo (% del total, con su split var/fija) → Activo (% de su clase)

Un activo **cuelga de un grupo** (`group_id`) y su `weight` es el peso dentro de
**su clase dentro del grupo** (los de renta variable de un grupo suman 100, y los
de renta fija otro 100). Si no tiene grupo (`group_id` NULL), es un activo
**suelto** y su `weight` es directamente su % **del total**. `asset_class` es una
**etiqueta** (variable/fija): dice de qué lado del split del grupo tira el activo.

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
# cada grupo (InvestmentGroup.variable_pct / fixed_pct).
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
    # Grupo del activo. Si es NULL, el activo es **suelto** y pesa sobre el total.
    # SET NULL: al borrar el grupo, el activo pasa a suelto.
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("investment_groups.id", ondelete="SET NULL"), index=True, nullable=True
    )
    # Peso objetivo: % de su clase dentro del grupo (si tiene grupo) o % del total
    # (si es suelto). Los hermanos del mismo padre y clase suman 100.
    weight: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal(0))
    # Archivar sin borrar: conserva el histórico de aportaciones (asset_id) intacto.
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
