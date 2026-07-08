"""Endpoints de autenticación (`/api/v1/auth`)."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserRead,
)
from app.services.auth_service import (
    EmailAlreadyExistsError,
    InvalidRefreshTokenError,
    NicknameAlreadyExistsError,
    authenticate_user,
    issue_token_pair,
    register_user,
    revoke_refresh_token,
    rotate_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
    try:
        return register_user(
            db, email=payload.email, password=payload.password, nickname=payload.nickname
        )
    except EmailAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ese email ya está registrado"
        ) from exc
    except NicknameAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ese nick ya está en uso"
        ) from exc


@router.post("/login", response_model=TokenPair)
@limiter.limit(settings.rate_limit_login)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> TokenPair:
    user = authenticate_user(db, identifier=payload.identifier, password=payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas"
        )
    access_token, refresh_token = issue_token_pair(db, user)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    try:
        _user, access_token, new_refresh = rotate_refresh_token(db, payload.refresh_token)
    except InvalidRefreshTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido"
        ) from exc
    return TokenPair(access_token=access_token, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: LogoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    revoke_refresh_token(db, raw_token=payload.refresh_token, user=user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> User:
    return user
