"""Modelo InvestmentGroup (grupo de la cartera: normalmente un bróker/cartera).

Un grupo es el contenedor de más alto nivel del reparto: agrupa activos que van
juntos —típicamente todo lo que tienes en un bróker— y lleva **su propio split**
entre renta variable y renta fija. Ya no hay un split global: cada grupo decide su
90/10 (o el que sea).

    Total → Grupo (% del total, con su split var/fija) → Activo (% de su clase)

`weight` es el peso del grupo **sobre el total**; los grupos y los activos sueltos
(sin grupo) suman 100. `variable_pct` + `fixed_pct` = 100: el reparto interno del
grupo entre sus activos de renta variable y los de renta fija.
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
    # Peso del grupo **sobre el total**; grupos + activos sueltos suman 100. Se elige
    # en euros del total del mes y se guarda como proporción: 8 decimales para que
    # el euro reconstruido cuadre al céntimo (2 decimales dejaban un desfase de 0,05).
    weight: Mapped[Decimal] = mapped_column(Numeric(11, 8), nullable=False, default=Decimal(0))
    # Split interno del grupo entre clases (suman 100). El reparto reparte primero
    # el dinero del grupo entre variable/fija, y luego dentro de cada clase.
    variable_pct: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=Decimal(100)
    )
    fixed_pct: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal(0))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
