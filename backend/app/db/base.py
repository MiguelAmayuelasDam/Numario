"""Base declarativa de SQLAlchemy 2.0.

Todos los modelos heredan de `Base`. `Base.metadata` es lo que Alembic usa como
objetivo para autogenerar migraciones.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
