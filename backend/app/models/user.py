"""Modelo User."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    # PK uuid para evitar enumeración de recursos (regla §7.7 de CLAUDE.md).
    # Se usa el tipo genérico `Uuid` (UUID nativo en Postgres, CHAR(32) en
    # SQLite) para que los tests puedan correr sobre SQLite en memoria.
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # Nick de perfil: obligatorio y único. Se normaliza a minúsculas en el
    # servicio para unicidad y login sin ambigüedad de mayúsculas.
    nickname: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
