"""Modelos SQLAlchemy.

Se importan aquí para que `Base.metadata` los conozca al ejecutar Alembic y al
crear el esquema en los tests.
"""

from app.models.budget import Budget
from app.models.category import Category
from app.models.category_forecast import CategoryForecast
from app.models.classification_rule import ClassificationRule
from app.models.refresh_token import RefreshToken
from app.models.transaction import Transaction
from app.models.user import User

__all__ = [
    "Budget",
    "Category",
    "CategoryForecast",
    "ClassificationRule",
    "RefreshToken",
    "Transaction",
    "User",
]
