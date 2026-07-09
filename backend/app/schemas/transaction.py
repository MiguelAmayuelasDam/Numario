"""Schemas de movimientos.

`amount` es `Decimal` y viaja en JSON como **string** (regla §7.1: los importes
no pierden precisión). Siempre positivo; el signo lo da `type`.
"""

import uuid
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.schemas.category import CategoryRead

TransactionType = Literal["income", "expense"]

_CENTS = Decimal("0.01")


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(_CENTS, rounding=ROUND_HALF_UP)


class TransactionCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    type: TransactionType
    concept: str = Field(min_length=1, max_length=255)
    occurred_on: date
    category_id: uuid.UUID | None = None

    @field_validator("amount")
    @classmethod
    def _quantize_amount(cls, value: Decimal) -> Decimal:
        return _quantize(value)


class TransactionUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    type: TransactionType | None = None
    concept: str | None = Field(default=None, min_length=1, max_length=255)
    occurred_on: date | None = None
    category_id: uuid.UUID | None = None

    @field_validator("amount")
    @classmethod
    def _quantize_amount(cls, value: Decimal | None) -> Decimal | None:
        return _quantize(value) if value is not None else None


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount: Decimal
    type: TransactionType
    concept: str
    occurred_on: date
    category_id: uuid.UUID | None
    category: CategoryRead | None
    source: str
    created_at: datetime

    @field_serializer("amount")
    def _serialize_amount(self, value: Decimal) -> str:
        return f"{_quantize(value):.2f}"
