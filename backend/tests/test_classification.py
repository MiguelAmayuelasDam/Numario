"""Tests del motor de clasificación (reglas + aprendizaje)."""

import pytest
from app.models.category import Category
from app.models.classification_rule import ClassificationRule
from app.models.user import User
from app.services.classification import classify, learn_keyword, learn_rule
from sqlalchemy import select
from sqlalchemy.orm import Session


@pytest.fixture
def user(db_session: Session) -> User:
    u = User(email="clf@mail.com", nickname="clf", password_hash="x")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def _category(db: Session, name: str) -> Category:
    return db.scalar(select(Category).where(Category.name == name, Category.user_id.is_(None)))


def test_seed_rule_matches(db_session: Session, user: User, seed_categories: None) -> None:
    result = classify(db_session, user, "MERCADONA JULIAN")
    assert result.source == "rule"
    assert result.category_id == _category(db_session, "Supermercado").id


def test_seed_rule_amazon_with_noise(
    db_session: Session, user: User, seed_categories: None
) -> None:
    result = classify(db_session, user, "WWW.AMAZON* YR49O")
    assert result.category_id == _category(db_session, "Otras compras").id


def test_unknown_concept_not_classified(
    db_session: Session, user: User, seed_categories: None
) -> None:
    result = classify(db_session, user, "COMERCIO RARISIMO XYZ")
    assert result.category_id is None
    assert result.source is None


def test_learned_rule_has_priority(
    db_session: Session, user: User, seed_categories: None
) -> None:
    # El usuario aprende que "konogan" es Restaurante.
    restaurante = _category(db_session, "Restaurante")
    db_session.add(
        ClassificationRule(user_id=user.id, keyword="konogan", category_id=restaurante.id)
    )
    db_session.commit()

    result = classify(db_session, user, "KONOGAN")
    assert result.source == "learned"
    assert result.category_id == restaurante.id


def test_learn_keyword_generalizes_and_skips_generic() -> None:
    assert learn_keyword("WWW.AMAZON* YR49O") == "amazon"
    assert learn_keyword("MERCADONA JULIAN") == "mercadona"
    # Conceptos genéricos no se aprenden (aplicarían a todo).
    assert learn_keyword("BIZUM ENVIADO") is None


def test_learn_rule_upsert(db_session: Session, user: User, seed_categories: None) -> None:
    ropa = _category(db_session, "Ropa")
    learn_rule(db_session, user, "TIENDA FULANITA", ropa.id)
    learn_rule(db_session, user, "TIENDA FULANITA", ropa.id)  # idempotente
    db_session.commit()
    rules = db_session.scalars(
        select(ClassificationRule).where(ClassificationRule.user_id == user.id)
    ).all()
    assert len(rules) == 1
    assert rules[0].keyword == "tienda"
