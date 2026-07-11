"""Lógica del presupuesto (50-30-20 configurable)."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.user import User

# Valores por defecto cuando el usuario aún no ha configurado su presupuesto.
DEFAULT_INCOME = Decimal("0")
DEFAULT_PCTS = (50, 30, 20)  # living, monthly, investment


def get_budget(db: Session, user: User) -> Budget | None:
    return db.scalar(select(Budget).where(Budget.user_id == user.id))


def get_or_default(db: Session, user: User) -> Budget:
    """Devuelve el presupuesto del usuario o uno por defecto (no persistido)."""
    budget = get_budget(db, user)
    if budget is not None:
        return budget
    return Budget(
        user_id=user.id,
        monthly_income=DEFAULT_INCOME,
        living_pct=DEFAULT_PCTS[0],
        monthly_pct=DEFAULT_PCTS[1],
        investment_pct=DEFAULT_PCTS[2],
    )


def upsert_budget(
    db: Session,
    user: User,
    *,
    monthly_income: Decimal,
    living_pct: int,
    monthly_pct: int,
    investment_pct: int,
) -> Budget:
    budget = get_budget(db, user)
    if budget is None:
        budget = Budget(user_id=user.id)
        db.add(budget)
    budget.monthly_income = monthly_income
    budget.living_pct = living_pct
    budget.monthly_pct = monthly_pct
    budget.investment_pct = investment_pct
    db.commit()
    db.refresh(budget)
    return budget
