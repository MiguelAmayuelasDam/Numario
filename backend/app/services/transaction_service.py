"""Lógica de negocio de movimientos."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.models.user import User
from app.services.category_service import resolve_category_for_user


class TransactionNotFoundError(Exception):
    """El movimiento no existe o no pertenece al usuario."""


def list_transactions(
    db: Session,
    user: User,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    category_id: uuid.UUID | None = None,
    type_: str | None = None,
    page: int = 1,
    size: int = 100,
) -> list[Transaction]:
    stmt = select(Transaction).where(Transaction.user_id == user.id)
    if date_from is not None:
        stmt = stmt.where(Transaction.occurred_on >= date_from)
    if date_to is not None:
        stmt = stmt.where(Transaction.occurred_on <= date_to)
    if category_id is not None:
        stmt = stmt.where(Transaction.category_id == category_id)
    if type_ is not None:
        stmt = stmt.where(Transaction.type == type_)
    # Orden: más reciente primero (US-07).
    stmt = stmt.order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())
    stmt = stmt.offset((page - 1) * size).limit(size)
    return list(db.scalars(stmt).all())


def create_transaction(
    db: Session,
    user: User,
    *,
    amount: Decimal,
    type_: str,
    concept: str,
    occurred_on: date,
    category_id: uuid.UUID | None,
) -> Transaction:
    # Valida que la categoría (si se indica) sea global o del usuario.
    resolve_category_for_user(db, user, category_id)
    transaction = Transaction(
        user_id=user.id,
        category_id=category_id,
        amount=amount,
        type=type_,
        concept=concept.strip(),
        occurred_on=occurred_on,
        source="manual",
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def get_transaction(db: Session, user: User, transaction_id: uuid.UUID) -> Transaction:
    transaction = db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_id != user.id:
        raise TransactionNotFoundError
    return transaction


def update_transaction(
    db: Session, user: User, transaction_id: uuid.UUID, changes: dict[str, Any]
) -> Transaction:
    transaction = get_transaction(db, user, transaction_id)
    if "category_id" in changes:
        resolve_category_for_user(db, user, changes["category_id"])
    for field, value in changes.items():
        if field == "concept" and isinstance(value, str):
            value = value.strip()
        setattr(transaction, field, value)
    db.commit()
    db.refresh(transaction)
    return transaction


def delete_transaction(db: Session, user: User, transaction_id: uuid.UUID) -> None:
    transaction = get_transaction(db, user, transaction_id)
    db.delete(transaction)
    db.commit()
