"""Modelos SQLAlchemy.

Se importan aquí para que `Base.metadata` los conozca al ejecutar Alembic y al
crear el esquema en los tests.
"""

from app.models.asset import Asset
from app.models.budget import Budget
from app.models.category import Category
from app.models.category_forecast import CategoryForecast
from app.models.classification_rule import ClassificationRule
from app.models.emergency_fund_contribution import EmergencyFundContribution
from app.models.investment_group import InvestmentGroup
from app.models.monthly_income import MonthlyIncome
from app.models.refresh_token import RefreshToken
from app.models.transaction import Transaction
from app.models.user import User

__all__ = [
    "Asset",
    "Budget",
    "Category",
    "CategoryForecast",
    "ClassificationRule",
    "EmergencyFundContribution",
    "InvestmentGroup",
    "MonthlyIncome",
    "RefreshToken",
    "Transaction",
    "User",
]
