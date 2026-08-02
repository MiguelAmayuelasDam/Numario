"""Schemas de la cartera de inversión."""

import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.asset import ASSET_CLASSES, ASSET_KINDS
from app.schemas.common import MAX_AMOUNT, MoneyStr

AssetClass = tuple(ASSET_CLASSES)  # ("variable", "fija")


class GroupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    asset_class: str
    weight: Decimal


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    asset_class: str = Field(pattern="^(variable|fija)$")
    weight: Decimal = Field(ge=0, le=100, max_digits=6, decimal_places=2)


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    asset_class: str | None = Field(default=None, pattern="^(variable|fija)$")
    weight: Decimal | None = Field(default=None, ge=0, le=100, max_digits=6, decimal_places=2)


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    asset_class: str
    kind: str
    weight: Decimal
    group_id: uuid.UUID | None
    active: bool


class AssetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    asset_class: str = Field(pattern="^(variable|fija)$")
    kind: str = Field(pattern="^(etf|fondo|accion|cripto|otro)$")
    weight: Decimal = Field(ge=0, le=100, max_digits=6, decimal_places=2)
    group_id: uuid.UUID | None = None  # None = cuelga directo de la clase

    @model_validator(mode="after")
    def _known_kind(self) -> "AssetCreate":
        if self.kind not in ASSET_KINDS or self.asset_class not in ASSET_CLASSES:
            raise ValueError("Clase o tipo de activo no válido")
        return self


class AssetUpdate(BaseModel):
    # `group_id` usa un centinela para distinguir "no tocar" de "poner a None".
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=100)
    asset_class: str | None = Field(default=None, pattern="^(variable|fija)$")
    kind: str | None = Field(default=None, pattern="^(etf|fondo|accion|cripto|otro)$")
    weight: Decimal | None = Field(default=None, ge=0, le=100, max_digits=6, decimal_places=2)
    group_id: uuid.UUID | None = None
    active: bool | None = None


class AllocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    variable_pct: int
    fixed_pct: int


class AllocationUpdate(BaseModel):
    variable_pct: int = Field(ge=0, le=100)
    fixed_pct: int = Field(ge=0, le=100)

    @model_validator(mode="after")
    def _sum_100(self) -> "AllocationUpdate":
        total = self.variable_pct + self.fixed_pct
        if total != 100:
            raise ValueError(f"Los porcentajes deben sumar 100 (suman {total})")
        return self


class MonthAssetRead(BaseModel):
    """Estado de un activo en un mes: lo previsto, lo aportado y si está hecho."""

    asset: AssetRead
    planned: MoneyStr
    contributed: MoneyStr
    done: bool


class ContributionCreate(BaseModel):
    asset_id: uuid.UUID
    amount: Decimal = Field(gt=0, le=MAX_AMOUNT, max_digits=12, decimal_places=2)
    # Si no se indica, el servicio elige (hoy, o el fin del mes indicado).
    occurred_on: date | None = None
