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
    AssetCreate,
    AssetRead,
    AssetUpdate,
    ContributionCreate,
    ContributionRead,
    GroupCreate,
    GroupRead,
    GroupUpdate,
    MonthAssetRead,
)
from app.schemas.transaction import TransactionRead
from app.services import investment_service
from app.services.investment_service import (
    AssetNotFoundError,
    GroupNotFoundError,
    WeightExceededError,
)

router = APIRouter(prefix="/investment", tags=["investment"])

_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
_GROUP_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Grupo no encontrado"
)


def _weight_error(err: WeightExceededError, *, scope: str = "asset") -> HTTPException:
    # El margen nunca se muestra negativo (datos heredados podrían dejarlo <0).
    room = err.room if err.room > 0 else Decimal(0)
    if scope == "group":
        # Aclara que es el peso **sobre el total** (grupos + sueltos), no el split
        # variable/fija del grupo, que es independiente y sí suma 100.
        detail = (
            f"Los pesos sobre el total (grupos y activos sueltos) superarían el 100%. "
            f"Queda {room}% libre; reduce el peso de otro grupo para hacer sitio."
        )
    else:
        detail = f"Los pesos superarían el 100%. Quedan {room}% libres."
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


# ── Grupos ──────────────────────────────────────────────────────────────────

@router.get("/groups", response_model=list[GroupRead])
def list_groups(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return investment_service.list_groups(db, user)


@router.post("/groups", response_model=GroupRead, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return investment_service.create_group(
            db,
            user,
            name=payload.name,
            weight=payload.weight,
            variable_pct=payload.variable_pct,
            fixed_pct=payload.fixed_pct,
        )
    except WeightExceededError as err:
        raise _weight_error(err, scope="group") from None


@router.patch("/groups/{group_id}", response_model=GroupRead)
def update_group(
    group_id: uuid.UUID,
    payload: GroupUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return investment_service.update_group(
            db, user, group_id, **payload.model_dump(exclude_unset=True)
        )
    except GroupNotFoundError:
        raise _GROUP_NOT_FOUND from None
    except WeightExceededError as err:
        raise _weight_error(err, scope="group") from None


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        investment_service.delete_group(db, user, group_id)
    except GroupNotFoundError:
        raise _GROUP_NOT_FOUND from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    try:
        return investment_service.create_asset(
            db,
            user,
            name=payload.name,
            asset_class=payload.asset_class,
            kind=payload.kind,
            weight=payload.weight,
            group_id=payload.group_id,
        )
    except GroupNotFoundError:
        raise _GROUP_NOT_FOUND from None
    except WeightExceededError as err:
        raise _weight_error(err) from None


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
    except GroupNotFoundError:
        raise _GROUP_NOT_FOUND from None
    except WeightExceededError as err:
        raise _weight_error(err) from None


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


@router.get("/history", response_model=list[ContributionRead])
def contribution_history(
    asset_id: uuid.UUID | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Histórico de aportaciones (todas, o las de un activo), de reciente a antiguo."""
    return investment_service.list_contributions(db, user, asset_id)


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
            db, user, payload.asset_id, payload.amount, occurred, payload.extra
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
