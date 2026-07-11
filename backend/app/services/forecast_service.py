"""Previsto (presupuesto) por categoría."""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.category_forecast import CategoryForecast
from app.models.user import User


def get_map(db: Session, user: User) -> dict[uuid.UUID, Decimal]:
    """Devuelve {category_id: previsto} del usuario."""
    rows = db.scalars(select(CategoryForecast).where(CategoryForecast.user_id == user.id)).all()
    return {r.category_id: r.amount for r in rows}


def set_forecast(db: Session, user: User, category_id: uuid.UUID, amount: Decimal) -> None:
    """Fija el previsto de una categoría. Con `amount <= 0` se elimina.

    Lanza `ValueError` si la categoría no existe o no es del usuario (ni global).
    """
    category = db.get(Category, category_id)
    if category is None or (category.user_id is not None and category.user_id != user.id):
        raise ValueError("Categoría no válida")

    existing = db.scalar(
        select(CategoryForecast).where(
            CategoryForecast.user_id == user.id,
            CategoryForecast.category_id == category_id,
        )
    )
    if amount <= 0:
        if existing is not None:
            db.delete(existing)
    elif existing is not None:
        existing.amount = amount
    else:
        db.add(CategoryForecast(user_id=user.id, category_id=category_id, amount=amount))
    db.commit()
