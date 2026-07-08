"""Primitivas de seguridad: hashing de contraseñas y tokens.

- Contraseñas con **argon2id** (vía `pwdlib`).
- Access tokens **JWT HS256** firmados con el secreto de entorno.
- Refresh tokens **opacos**: se devuelve el token en claro al cliente y solo se
  persiste su `sha256` (regla: nunca guardar el secreto en claro).
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

# argon2id como algoritmo recomendado.
_password_hash = PasswordHash.recommended()

# Hash "señuelo" para verificar en tiempo constante cuando el usuario no existe
# (mitiga enumeración de usuarios por diferencia de tiempos).
_DUMMY_HASH = _password_hash.hash("dummy-password-para-timing-constante")


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hash.verify(password, password_hash)
    except Exception:
        return False


def verify_password_dummy() -> None:
    """Verifica contra un hash señuelo para igualar el coste temporal."""
    try:
        _password_hash.verify("dummy", _DUMMY_HASH)
    except Exception:
        pass


def create_access_token(subject: str) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica y valida un access token. Lanza `jwt.InvalidTokenError` si es
    inválido, expirado o de un tipo inesperado."""
    payload: dict[str, Any] = jwt.decode(
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("tipo de token inesperado")
    return payload


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> tuple[str, str]:
    """Devuelve `(token_en_claro, sha256_del_token)`."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)
