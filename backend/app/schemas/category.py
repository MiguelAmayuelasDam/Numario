"""Schemas de categorías."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Bucket = Literal["living", "monthly", "investment", "income"]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    bucket: Bucket


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    bucket: Bucket | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    bucket: Bucket
    is_default: bool
