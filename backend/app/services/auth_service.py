"""Lógica de negocio de autenticación.

Independiente de FastAPI: recibe una `Session` y datos primitivos, de modo que
se puede testear sin levantar HTTP (facilita el TDD).
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
    verify_password_dummy,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User


class EmailAlreadyExistsError(Exception):
    """El email ya está registrado."""


class NicknameAlreadyExistsError(Exception):
    """El nick ya está en uso."""


class InvalidRefreshTokenError(Exception):
    """El refresh token no existe, está revocado o ha expirado."""


def _normalize(value: str) -> str:
    return value.strip().lower()


def register_user(db: Session, *, email: str, password: str, nickname: str) -> User:
    email_n = _normalize(email)
    nickname_n = _normalize(nickname)

    if db.scalar(select(User).where(User.email == email_n)) is not None:
        raise EmailAlreadyExistsError
    if db.scalar(select(User).where(User.nickname == nickname_n)) is not None:
        raise NicknameAlreadyExistsError

    user = User(email=email_n, nickname=nickname_n, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, identifier: str, password: str) -> User | None:
    ident = _normalize(identifier)
    user = db.scalar(select(User).where((User.email == ident) | (User.nickname == ident)))
    if user is None:
        # Verificación señuelo para no filtrar por tiempo si el usuario existe.
        verify_password_dummy()
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def issue_token_pair(db: Session, user: User) -> tuple[str, str]:
    """Crea un access JWT y un refresh opaco (persistiendo solo su hash)."""
    access_token = create_access_token(str(user.id))
    raw_refresh, token_hash = generate_refresh_token()
    expires_at = datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days)
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at))
    db.commit()
    return access_token, raw_refresh


def _get_active_refresh(db: Session, raw_token: str) -> RefreshToken:
    token_hash = hash_refresh_token(raw_token)
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if row is None or row.revoked_at is not None:
        raise InvalidRefreshTokenError
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        raise InvalidRefreshTokenError
    return row


def rotate_refresh_token(db: Session, raw_token: str) -> tuple[User, str, str]:
    """Valida el refresh, **revoca el antiguo** y emite un par nuevo (rotación).

    Reutilizar un token ya rotado falla con `InvalidRefreshTokenError`.
    """
    row = _get_active_refresh(db, raw_token)
    row.revoked_at = datetime.now(UTC)
    user = db.get(User, row.user_id)
    if user is None:
        raise InvalidRefreshTokenError
    db.commit()
    access_token, new_refresh = issue_token_pair(db, user)
    return user, access_token, new_refresh


def revoke_refresh_token(db: Session, *, raw_token: str, user: User) -> None:
    """Logout: revoca el refresh indicado si pertenece al usuario."""
    token_hash = hash_refresh_token(raw_token)
    row = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user.id,
        )
    )
    if row is not None and row.revoked_at is None:
        row.revoked_at = datetime.now(UTC)
        db.commit()
