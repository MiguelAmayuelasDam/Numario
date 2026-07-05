"""Modelo User.

En la Fase 1 solo se define el **esquema** de la tabla (sin lógica de auth, que
llega en la Fase 2). Sirve para que la primera migración de Alembic cree una
tabla real y valide el pipeline SQLAlchemy → Alembic → PostgreSQL.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    # PK uuid para evitar enumeración de recursos (regla §7.7 de CLAUDE.md).
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
