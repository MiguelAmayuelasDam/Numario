"""Endpoints de importación de CSV (`/api/v1/import`)."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.import_ import ConfirmRequest, ConfirmResponse, PreviewResponse
from app.services import import_service
from app.services.category_service import CategoryNotFoundError

router = APIRouter(prefix="/import", tags=["import"])


@router.post("/preview", response_model=PreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewResponse:
    raw = await file.read()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo está vacío"
        )
    return import_service.preview(db, user, raw)


@router.post("/confirm", response_model=ConfirmResponse, status_code=status.HTTP_201_CREATED)
def confirm_import(
    payload: ConfirmRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConfirmResponse:
    try:
        created = import_service.confirm(db, user, payload.items)
    except CategoryNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Alguna categoría indicada no existe o no es tuya",
        ) from exc
    return ConfirmResponse(created=created)
