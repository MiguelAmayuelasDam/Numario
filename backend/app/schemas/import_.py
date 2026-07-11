"""Schemas de importación de CSV."""

import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.schemas.category import CategoryRead
from app.schemas.transaction import TransactionType

_CENTS = Decimal("0.01")


class PreviewRow(BaseModel):
    concept: str
    occurred_on: date
    amount: Decimal
    type: TransactionType
    suggested_category_id: uuid.UUID | None
    category: CategoryRead | None
    source: str | None  # "learned" | "rule" | None
    duplicate: bool

    @field_serializer("amount")
    def _serialize_amount(self, value: Decimal) -> str:
        return f"{value.quantize(_CENTS, rounding=ROUND_HALF_UP):.2f}"


class ImportSummary(BaseModel):
    total: int
    classified: int
    needs_review: int
    duplicates: int
    errors: int


class PreviewResponse(BaseModel):
    rows: list[PreviewRow]
    summary: ImportSummary
    error_details: list[str] = Field(default_factory=list)


class ConfirmItem(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    type: TransactionType
    concept: str = Field(min_length=1, max_length=255)
    occurred_on: date
    category_id: uuid.UUID | None = None

    @field_validator("amount")
    @classmethod
    def _quantize(cls, value: Decimal) -> Decimal:
        return value.quantize(_CENTS, rounding=ROUND_HALF_UP)


class ConfirmRequest(BaseModel):
    items: list[ConfirmItem] = Field(min_length=1)


class ConfirmResponse(BaseModel):
    created: int
