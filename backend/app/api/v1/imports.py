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

# Los extractos bancarios son pequeños; acotar el tamaño evita agotar memoria (DoS).
MAX_CSV_BYTES = 2 * 1024 * 1024  # 2 MiB


@router.post("/preview", response_model=PreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreviewResponse:
    # Se lee como mucho el límite + 1 byte: así se detecta el exceso sin cargar en
    # memoria un archivo enorme.
    raw = await file.read(MAX_CSV_BYTES + 1)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo está vacío"
        )
    if len(raw) > MAX_CSV_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el tamaño máximo (2 MiB)",
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
