"""Schemas de autenticación."""

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationInfo, field_validator

from app.core.password_policy import validate_password

# Patrón de nick: letras (incl. tildes, ñ, ü…), números y . _ - (sin espacios).
# `\w` en el regex de Pydantic es Unicode, así que admite caracteres del español.
NICKNAME_PATTERN = r"^[\w.-]+$"


class RegisterRequest(BaseModel):
    email: EmailStr
    nickname: str = Field(min_length=3, max_length=30, pattern=NICKNAME_PATTERN)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def _check_password_policy(cls, value: str, info: ValidationInfo) -> str:
        # `info.data` trae email y nickname ya validados (van antes en la clase).
        errors = validate_password(
            value, email=info.data.get("email"), nickname=info.data.get("nickname")
        )
        if errors:
            raise ValueError("; ".join(errors))
        return value


class LoginRequest(BaseModel):
    # Identificador flexible: email o nick.
    identifier: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    nickname: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
