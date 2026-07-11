"""Endpoints de analítica (`/api/v1/analytics`)."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsOverview, SeriesPoint
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])

Granularity = Literal["month", "year"]


@router.get("/overview", response_model=AnalyticsOverview)
def overview(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    granularity: Granularity = "month",
    year: int = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
    month: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
) -> AnalyticsOverview:
    return analytics_service.overview(db, user, granularity, year, month)


@router.get("/series", response_model=list[SeriesPoint])
def series(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    granularity: Granularity = "month",
    count: int = Query(default=12, ge=1, le=36),
) -> list:
    return analytics_service.series(db, user, granularity, count)
