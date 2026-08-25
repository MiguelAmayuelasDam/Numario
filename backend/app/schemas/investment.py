"""Schemas de la cartera de inversión."""

import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.asset import ASSET_CLASSES, ASSET_KINDS
from app.schemas.common import MAX_AMOUNT, MoneyStr

AssetClass = tuple(ASSET_CLASSES)  # ("variable", "fija")


def _split_sums_100(variable_pct: Decimal | None, fixed_pct: Decimal | None) -> None:
    """El split variable/fija de un grupo debe sumar 100 (si viene alguno, ambos)."""
    if variable_pct is None and fixed_pct is None:
        return
    if variable_pct is None or fixed_pct is None:
        raise ValueError("Indica variable_pct y fixed_pct juntos")
    total = variable_pct + fixed_pct
    if total != 100:
        raise ValueError(f"El split del grupo debe sumar 100 (suman {total})")


class GroupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    weight: Decimal
    variable_pct: Decimal
    fixed_pct: Decimal


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    # El peso va en euros del total; se guarda como proporción con más decimales
    # (8) para que el euro cuadre exacto. Los splits siguen en 2 decimales (son %).
    weight: Decimal = Field(ge=0, le=100, max_digits=11, decimal_places=8)
    variable_pct: Decimal = Field(
        default=Decimal(100), ge=0, le=100, max_digits=6, decimal_places=2
    )
    fixed_pct: Decimal = Field(default=Decimal(0), ge=0, le=100, max_digits=6, decimal_places=2)

    @model_validator(mode="after")
    def _check_split(self) -> "GroupCreate":
        _split_sums_100(self.variable_pct, self.fixed_pct)
        return self


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    weight: Decimal | None = Field(default=None, ge=0, le=100, max_digits=11, decimal_places=8)
    variable_pct: Decimal | None = Field(
        default=None, ge=0, le=100, max_digits=6, decimal_places=2
    )
    fixed_pct: Decimal | None = Field(default=None, ge=0, le=100, max_digits=6, decimal_places=2)

    @model_validator(mode="after")
    def _check_split(self) -> "GroupUpdate":
        _split_sums_100(self.variable_pct, self.fixed_pct)
        return self


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
    group_id: uuid.UUID | None = None  # None = activo suelto (pesa sobre el total)

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


class MonthAssetRead(BaseModel):
    """Estado de un activo en un mes: lo previsto, lo aportado y si está hecho."""

    asset: AssetRead
    planned: MoneyStr
    contributed: MoneyStr
    done: bool
    total_contributed: MoneyStr  # acumulado de toda su historia


class ContributionRead(BaseModel):
    """Una aportación del histórico (un movimiento con activo)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    asset_id: uuid.UUID | None
    concept: str
    amount: MoneyStr
    occurred_on: date


class ContributionCreate(BaseModel):
    asset_id: uuid.UUID
    amount: Decimal = Field(gt=0, le=MAX_AMOUNT, max_digits=12, decimal_places=2)
    # Si no se indica, el servicio elige (hoy, o el fin del mes indicado).
    occurred_on: date | None = None
    # Aportación manual al margen del reparto (se etiqueta en el concepto).
    extra: bool = False
