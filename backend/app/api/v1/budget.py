"""Endpoints de presupuesto (`/api/v1/budget`)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.budget import BudgetRead, BudgetUpdate
from app.services import budget_service

router = APIRouter(prefix="/budget", tags=["budget"])


@router.get("", response_model=BudgetRead)
def get_budget(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return budget_service.get_or_default(db, user)


@router.put("", response_model=BudgetRead)
def update_budget(
    payload: BudgetUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return budget_service.upsert_budget(
        db,
        user,
        monthly_income=payload.monthly_income,
        living_pct=payload.living_pct,
        monthly_pct=payload.monthly_pct,
        investment_pct=payload.investment_pct,
    )
