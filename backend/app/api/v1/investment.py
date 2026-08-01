"""Endpoints de la cartera de inversión (`/api/v1/investment`)."""

import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.investment import (
    AllocationRead,
    AllocationUpdate,
    AssetCreate,
    AssetRead,
    AssetUpdate,
    ContributionCreate,
    MonthAssetRead,
)
from app.schemas.transaction import TransactionRead
from app.services import investment_service
from app.services.investment_service import AssetNotFoundError

router = APIRouter(prefix="/investment", tags=["investment"])

_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")


# ── Reparto entre clases ────────────────────────────────────────────────────

@router.get("/allocation", response_model=AllocationRead)
def get_allocation(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return investment_service.get_allocation(db, user)


@router.put("/allocation", response_model=AllocationRead)
def set_allocation(
    payload: AllocationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return investment_service.set_allocation(db, user, payload.variable_pct, payload.fixed_pct)


# ── Activos ─────────────────────────────────────────────────────────────────

@router.get("/assets", response_model=list[AssetRead])
def list_assets(
    include_archived: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return investment_service.list_assets(db, user, include_archived=include_archived)


@router.post("/assets", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
def create_asset(
    payload: AssetCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return investment_service.create_asset(
        db,
        user,
        name=payload.name,
        asset_class=payload.asset_class,
        kind=payload.kind,
        weight=payload.weight,
    )


@router.patch("/assets/{asset_id}", response_model=AssetRead)
def update_asset(
    asset_id: uuid.UUID,
    payload: AssetUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return investment_service.update_asset(
            db, user, asset_id, **payload.model_dump(exclude_unset=True)
        )
    except AssetNotFoundError:
        raise _NOT_FOUND from None


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        investment_service.delete_asset(db, user, asset_id)
    except AssetNotFoundError:
        raise _NOT_FOUND from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Plan del mes y aportaciones ─────────────────────────────────────────────

@router.get("/month", response_model=list[MonthAssetRead])
def month_status(
    year: int = Query(),
    month: int = Query(ge=1, le=12),
    total: Decimal = Query(default=Decimal(0), ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reparto y estado del mes. `total` es lo que se piensa invertir (para el
    cálculo); lo aportado de verdad sale de los movimientos."""
    return investment_service.month_status(db, user, year, month, total)


@router.post(
    "/contributions", response_model=TransactionRead, status_code=status.HTTP_201_CREATED
)
def record_contribution(
    payload: ContributionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marca una aportación como hecha: crea el movimiento (traspaso al activo)."""
    occurred = payload.occurred_on or date.today()
    try:
        return investment_service.record_contribution(
            db, user, payload.asset_id, payload.amount, occurred
        )
    except AssetNotFoundError:
        raise _NOT_FOUND from None


@router.delete("/contributions", status_code=status.HTTP_204_NO_CONTENT)
def undo_contributions(
    asset_id: uuid.UUID = Query(),
    year: int = Query(),
    month: int = Query(ge=1, le=12),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Desmarca: borra las aportaciones de un activo en un mes."""
    try:
        investment_service.undo_contributions(db, user, asset_id, year, month)
    except AssetNotFoundError:
        raise _NOT_FOUND from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
