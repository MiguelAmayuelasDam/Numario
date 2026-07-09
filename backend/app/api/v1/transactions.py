"""Endpoints de movimientos (`/api/v1/transactions`)."""

import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate
from app.services import transaction_service
from app.services.category_service import CategoryNotFoundError
from app.services.transaction_service import TransactionNotFoundError

router = APIRouter(prefix="/transactions", tags=["transactions"])

_INVALID_CATEGORY = HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
    detail="La categoría indicada no existe o no es tuya",
)
_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Movimiento no encontrado"
)


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    category_id: uuid.UUID | None = None,
    type_: Literal["income", "expense"] | None = Query(default=None, alias="type"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=100, ge=1, le=500),
) -> list:
    return transaction_service.list_transactions(
        db,
        user,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        type_=type_,
        page=page,
        size=size,
    )


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return transaction_service.create_transaction(
            db,
            user,
            amount=payload.amount,
            type_=payload.type,
            concept=payload.concept,
            occurred_on=payload.occurred_on,
            category_id=payload.category_id,
        )
    except CategoryNotFoundError as exc:
        raise _INVALID_CATEGORY from exc


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return transaction_service.get_transaction(db, user, transaction_id)
    except TransactionNotFoundError as exc:
        raise _NOT_FOUND from exc


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    changes = payload.model_dump(exclude_unset=True)
    try:
        return transaction_service.update_transaction(db, user, transaction_id, changes)
    except TransactionNotFoundError as exc:
        raise _NOT_FOUND from exc
    except CategoryNotFoundError as exc:
        raise _INVALID_CATEGORY from exc


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        transaction_service.delete_transaction(db, user, transaction_id)
    except TransactionNotFoundError as exc:
        raise _NOT_FOUND from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
