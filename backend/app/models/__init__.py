"""Modelos SQLAlchemy.

Se importan aquí para que `Base.metadata` los conozca al ejecutar Alembic.
"""

from app.models.user import User

__all__ = ["User"]
