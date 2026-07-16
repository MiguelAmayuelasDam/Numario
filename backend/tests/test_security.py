"""Tests de las primitivas de seguridad (hash + JWT) y cabeceras HTTP."""

import time

import jwt
import pytest
from app.core import security
from app.core.config import settings
from fastapi.testclient import TestClient


def test_security_headers_present(client: TestClient) -> None:
    response = client.get("/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"


def test_hash_and_verify_password() -> None:
    hashed = security.hash_password("Str0ng!Pass")
    assert hashed != "Str0ng!Pass"  # no en claro
    assert security.verify_password("Str0ng!Pass", hashed) is True
    assert security.verify_password("otra-cosa", hashed) is False


def test_verify_password_invalid_hash_is_false() -> None:
    assert security.verify_password("x", "no-es-un-hash-valido") is False


def test_access_token_roundtrip() -> None:
    token = security.create_access_token("subject-123")
    payload = security.decode_access_token(token)
    assert payload["sub"] == "subject-123"
    assert payload["type"] == "access"


def test_decode_rejects_tampered_token() -> None:
    token = security.create_access_token("subject-123")
    with pytest.raises(jwt.InvalidTokenError):
        security.decode_access_token(token + "tampered")


def test_decode_rejects_expired_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_access_token_expire_minutes", -1)
    token = security.create_access_token("subject-123")
    time.sleep(0.01)
    with pytest.raises(jwt.ExpiredSignatureError):
        security.decode_access_token(token)


def test_refresh_token_hash_is_deterministic_and_opaque() -> None:
    raw, token_hash = security.generate_refresh_token()
    assert raw != token_hash
    assert len(token_hash) == 64  # sha256 hex
    assert security.hash_refresh_token(raw) == token_hash
