"""Modelo ClassificationRule.

Regla aprendida del feedback del usuario: si un `keyword` (normalizado) aparece
en el concepto de un movimiento, se sugiere la `category_id` asociada. Alimenta
el motor de clasificación y reduce el trabajo manual con el tiempo (US-14).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ClassificationRule(Base):
    __tablename__ = "classification_rules"
    # Un usuario no repite keyword (upsert al aprender).
    __table_args__ = (
        UniqueConstraint("user_id", "keyword", name="uq_classification_rules_user_keyword"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    keyword: Mapped[str] = mapped_column(String(120), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("categories.id", ondelete="SET NULL"), index=True, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
