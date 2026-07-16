"""Lógica del presupuesto (50-30-20 configurable) e ingreso mensual variable.

El reparto 50-30-20 (porcentajes) es global por usuario. El **ingreso** puede
variar mes a mes: se guarda por (año, mes) en `MonthlyIncome`; los meses sin
ajuste caen en el "ingreso habitual" por defecto (`Budget.monthly_income`).
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.monthly_income import MonthlyIncome
from app.models.user import User

# Valores por defecto cuando el usuario aún no ha configurado su presupuesto.
DEFAULT_INCOME = Decimal("0")
DEFAULT_PCTS = (50, 30, 20)  # living, monthly, investment
DEFAULT_EMERGENCY_MONTHS = 6  # meses objetivo del colchón (3–6)


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
        emergency_fund_months=DEFAULT_EMERGENCY_MONTHS,
    )


def _get_or_create_budget(db: Session, user: User) -> Budget:
    """Presupuesto persistido del usuario; lo crea (sin commit) si aún no existe."""
    budget = get_budget(db, user)
    if budget is None:
        budget = Budget(user_id=user.id)
        db.add(budget)
    return budget


def _default_income(db: Session, user: User) -> Decimal:
    budget = get_budget(db, user)
    return budget.monthly_income if budget is not None else DEFAULT_INCOME


def income_for_month(db: Session, user: User, year: int, month: int) -> Decimal:
    """Ingreso del mes: el ajuste propio si existe, si no el habitual por defecto."""
    override = db.scalar(
        select(MonthlyIncome).where(
            MonthlyIncome.user_id == user.id,
            MonthlyIncome.year == year,
            MonthlyIncome.month == month,
        )
    )
    return override.amount if override is not None else _default_income(db, user)


def income_for_period(
    db: Session, user: User, granularity: str, year: int, month: int
) -> Decimal:
    """Ingreso base para dimensionar los cubos 50-30-20.

    - `month`: el ingreso de ese (año, mes).
    - `year`: la **suma** de los 12 meses del año (cada uno con su ajuste o el habitual).
    """
    if granularity == "year":
        default = _default_income(db, user)
        overrides = {
            r.month: r.amount
            for r in db.scalars(
                select(MonthlyIncome).where(
                    MonthlyIncome.user_id == user.id, MonthlyIncome.year == year
                )
            ).all()
        }
        return sum((overrides.get(m, default) for m in range(1, 13)), Decimal(0))
    return income_for_month(db, user, year, month)


def upsert_budget(
    db: Session,
    user: User,
    *,
    living_pct: int,
    monthly_pct: int,
    investment_pct: int,
    monthly_income: Decimal | None = None,
) -> Budget:
    """Actualiza los porcentajes (siempre) y el ingreso habitual (solo si se da)."""
    budget = _get_or_create_budget(db, user)
    budget.living_pct = living_pct
    budget.monthly_pct = monthly_pct
    budget.investment_pct = investment_pct
    if monthly_income is not None:
        budget.monthly_income = monthly_income
    db.commit()
    db.refresh(budget)
    return budget


def set_emergency_months(db: Session, user: User, months: int) -> None:
    """Fija los meses objetivo del colchón (crea el presupuesto si no existe)."""
    budget = _get_or_create_budget(db, user)
    budget.emergency_fund_months = months
    db.commit()


def set_emergency_monthly_need(db: Session, user: User, amount: Decimal) -> None:
    """Fija el gasto mensual de referencia del colchón (crea el presupuesto si no existe)."""
    budget = _get_or_create_budget(db, user)
    budget.emergency_monthly_need = amount
    db.commit()


def set_monthly_income(
    db: Session, user: User, year: int, month: int, amount: Decimal
) -> None:
    """Fija (upsert) el ingreso de un (año, mes) concreto."""
    existing = db.scalar(
        select(MonthlyIncome).where(
            MonthlyIncome.user_id == user.id,
            MonthlyIncome.year == year,
            MonthlyIncome.month == month,
        )
    )
    if existing is not None:
        existing.amount = amount
    else:
        db.add(MonthlyIncome(user_id=user.id, year=year, month=month, amount=amount))
    db.commit()
