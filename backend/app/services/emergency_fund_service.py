"""Lógica del colchón de emergencia.

El objetivo se dimensiona sobre el **gasto mensual de referencia** (el ingreso
mensual habitual, que cubre vida + mes + inversión) por los meses objetivo (3–6).
El progreso es la suma de las aportaciones registradas.
"""

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.emergency_fund_contribution import EmergencyFundContribution as Contribution
from app.models.user import User
from app.schemas.common import quantize_money
from app.services import budget_service


def list_contributions(db: Session, user: User) -> list[Contribution]:
    return list(
        db.scalars(
            select(Contribution)
            .where(Contribution.user_id == user.id)
            .order_by(Contribution.occurred_on.desc(), Contribution.created_at.desc())
        ).all()
    )


def total_saved(db: Session, user: User) -> Decimal:
    return Decimal(
        db.scalar(
            select(func.coalesce(func.sum(Contribution.amount), 0)).where(
                Contribution.user_id == user.id
            )
        )
        or 0
    )


def add_contribution(db: Session, user: User, amount: Decimal, occurred_on) -> Contribution:
    contribution = Contribution(user_id=user.id, amount=amount, occurred_on=occurred_on)
    db.add(contribution)
    db.commit()
    db.refresh(contribution)
    return contribution


def delete_contribution(db: Session, user: User, contribution_id: uuid.UUID) -> bool:
    contribution = db.get(Contribution, contribution_id)
    if contribution is None or contribution.user_id != user.id:
        return False
    db.delete(contribution)
    db.commit()
    return True


def summary(db: Session, user: User) -> dict:
    budget = budget_service.get_or_default(db, user)
    # Gasto mensual de referencia: el que fije el usuario o, si no, su ingreso habitual.
    monthly_need = (
        budget.emergency_monthly_need
        if budget.emergency_monthly_need is not None
        else budget.monthly_income
    )
    months = budget.emergency_fund_months
    target = quantize_money(monthly_need * months)
    saved = total_saved(db, user)
    remaining = target - saved
    if remaining < 0:
        remaining = Decimal(0)
    pct = int(saved / target * 100) if target > 0 else 0
    return {
        "monthly_need": monthly_need,
        "target_months": months,
        "target": target,
        "saved": saved,
        "remaining": remaining,
        "pct": pct,
        "contributions": list_contributions(db, user),
    }
