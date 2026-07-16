"""Schemas de movimientos.

`amount` es `Decimal` y viaja en JSON como **string** (regla §7.1: los importes
no pierden precisión). Siempre positivo; el signo lo da `type`.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.schemas.category import CategoryRead
from app.schemas.common import MAX_AMOUNT, quantize_money

# income = ingreso · expense = gasto · transfer = no computable (traspaso).
TransactionType = Literal["income", "expense", "transfer"]


class TransactionCreate(BaseModel):
    amount: Decimal = Field(gt=0, le=MAX_AMOUNT, max_digits=12, decimal_places=2)
    type: TransactionType
    concept: str = Field(min_length=1, max_length=255)
    occurred_on: date
    category_id: uuid.UUID | None = None

    @field_validator("amount")
    @classmethod
    def _quantize_amount(cls, value: Decimal) -> Decimal:
        return quantize_money(value)


class TransactionUpdate(BaseModel):
    amount: Decimal | None = Field(
        default=None, gt=0, le=MAX_AMOUNT, max_digits=12, decimal_places=2
    )
    type: TransactionType | None = None
    concept: str | None = Field(default=None, min_length=1, max_length=255)
    occurred_on: date | None = None
    category_id: uuid.UUID | None = None

    @field_validator("amount")
    @classmethod
    def _quantize_amount(cls, value: Decimal | None) -> Decimal | None:
        return quantize_money(value) if value is not None else None


class TransactionSplitPart(BaseModel):
    amount: Decimal = Field(gt=0, le=MAX_AMOUNT, max_digits=12, decimal_places=2)
    category_id: uuid.UUID | None = None

    @field_validator("amount")
    @classmethod
    def _quantize_amount(cls, value: Decimal) -> Decimal:
        return quantize_money(value)


class TransactionSplitRequest(BaseModel):
    # Al menos 2 partes: dividir en 1 no tendría sentido.
    parts: list[TransactionSplitPart] = Field(min_length=2)


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
        return f"{quantize_money(value):.2f}"
