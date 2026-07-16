"""Guarda de configuración: producción no puede usar el secreto de desarrollo."""

import pytest
from app.core.config import DEV_JWT_SECRET, Settings


def test_production_rejects_dev_secret() -> None:
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        Settings(environment="production", jwt_secret_key=DEV_JWT_SECRET)


def test_production_ok_with_real_secret() -> None:
    s = Settings(environment="production", jwt_secret_key="un-secreto-largo-y-aleatorio-123456")
    assert s.environment == "production"


def test_development_allows_dev_secret() -> None:
    s = Settings(environment="development", jwt_secret_key=DEV_JWT_SECRET)
    assert s.jwt_secret_key == DEV_JWT_SECRET
