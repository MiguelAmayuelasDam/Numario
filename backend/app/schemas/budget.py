"""Schemas de presupuesto (50-30-20 configurable)."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import MoneyStr


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    monthly_income: MoneyStr
    living_pct: int
    monthly_pct: int
    investment_pct: int


class BudgetUpdate(BaseModel):
    monthly_income: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    living_pct: int = Field(ge=0, le=100)
    monthly_pct: int = Field(ge=0, le=100)
    investment_pct: int = Field(ge=0, le=100)

    @model_validator(mode="after")
    def _check_percentages(self) -> "BudgetUpdate":
        total = self.living_pct + self.monthly_pct + self.investment_pct
        if total != 100:
            raise ValueError(f"Los porcentajes deben sumar 100 (suman {total})")
        return self
