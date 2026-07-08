"""Schemas de autenticación."""

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.core.password_policy import validate_password

# Patrón de nick: letras, números y . _ - (sin espacios ni símbolos raros).
NICKNAME_PATTERN = r"^[a-zA-Z0-9_.-]+$"


class RegisterRequest(BaseModel):
    email: EmailStr
    nickname: str = Field(min_length=3, max_length=30, pattern=NICKNAME_PATTERN)
    password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def _check_password_policy(self) -> "RegisterRequest":
        errors = validate_password(self.password, email=self.email, nickname=self.nickname)
        if errors:
            raise ValueError("; ".join(errors))
        return self


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
