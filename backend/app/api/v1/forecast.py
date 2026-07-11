"""Endpoint de previsto por categoría (`/api/v1/forecast`)."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.budget import ForecastUpdate
from app.services import forecast_service

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.put("", status_code=status.HTTP_204_NO_CONTENT)
def set_forecast(
    payload: ForecastUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        forecast_service.set_forecast(db, user, payload.category_id, payload.amount)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
