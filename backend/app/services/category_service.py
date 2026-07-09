"""Lógica de negocio de categorías."""

import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.user import User


class CategoryNotFoundError(Exception):
    """La categoría no existe o no es accesible por el usuario."""


class CategoryForbiddenError(Exception):
    """La categoría existe pero es global/ajena (no se puede modificar)."""


class CategoryAlreadyExistsError(Exception):
    """El usuario ya tiene una categoría con ese nombre."""


def list_categories(db: Session, user: User) -> list[Category]:
    """Categorías globales (por defecto) + las propias del usuario."""
    stmt = (
        select(Category)
        .where(or_(Category.user_id.is_(None), Category.user_id == user.id))
        .order_by(Category.bucket, Category.name)
    )
    return list(db.scalars(stmt).all())


def create_category(db: Session, user: User, *, name: str, bucket: str) -> Category:
    name = name.strip()
    exists = db.scalar(
        select(Category).where(Category.user_id == user.id, Category.name == name)
    )
    if exists is not None:
        raise CategoryAlreadyExistsError
    category = Category(user_id=user.id, name=name, bucket=bucket, is_default=False)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def _get_owned(db: Session, user: User, category_id: uuid.UUID) -> Category:
    """Devuelve la categoría solo si es propia y editable; si no, lanza."""
    category = db.get(Category, category_id)
    if category is None:
        raise CategoryNotFoundError
    if category.is_default or category.user_id != user.id:
        raise CategoryForbiddenError
    return category


def update_category(
    db: Session, user: User, category_id: uuid.UUID, *, name: str | None, bucket: str | None
) -> Category:
    category = _get_owned(db, user, category_id)
    if name is not None:
        new_name = name.strip()
        clash = db.scalar(
            select(Category).where(
                Category.user_id == user.id,
                Category.name == new_name,
                Category.id != category_id,
            )
        )
        if clash is not None:
            raise CategoryAlreadyExistsError
        category.name = new_name
    if bucket is not None:
        category.bucket = bucket
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, user: User, category_id: uuid.UUID) -> None:
    category = _get_owned(db, user, category_id)
    db.delete(category)
    db.commit()


def resolve_category_for_user(
    db: Session, user: User, category_id: uuid.UUID | None
) -> Category | None:
    """Valida que un `category_id` sea usable por el usuario (global o propia).

    Devuelve la categoría (o None si `category_id` es None). Lanza
    `CategoryNotFoundError` si la categoría no existe o es de otro usuario.
    """
    if category_id is None:
        return None
    category = db.get(Category, category_id)
    if category is None or (category.user_id is not None and category.user_id != user.id):
        raise CategoryNotFoundError
    return category
