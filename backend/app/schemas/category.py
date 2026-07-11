"""Schemas de categorías."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Buckets 50-30-20 + `transfer` (no computable, solo en categorías por defecto).
Bucket = Literal["living", "monthly", "investment", "income", "transfer"]
# Los usuarios solo crean categorías en los 4 cubos del 50-30-20.
CreatableBucket = Literal["living", "monthly", "investment", "income"]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    bucket: CreatableBucket
    emoji: str | None = Field(default=None, max_length=16)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    bucket: CreatableBucket | None = None
    emoji: str | None = Field(default=None, max_length=16)


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    bucket: Bucket
    emoji: str | None
    is_default: bool
