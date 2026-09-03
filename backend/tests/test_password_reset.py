"""Tests de recuperación de contraseña por correo."""

import re

import pytest
from app.services import email_service
from fastapi.testclient import TestClient

BASE = "/api/v1/auth"


@pytest.fixture
def captured(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """Captura el enlace de reset que se 'enviaría' por email (sin enviar nada)."""
    sent: dict[str, str] = {}

    def fake(*, to: str, reset_url: str) -> None:
        sent["to"] = to
        sent["url"] = reset_url

    monkeypatch.setattr(email_service, "send_password_reset", fake)
    return sent


def _register(client: TestClient, email: str, nick: str, pw: str = "Str0ng!Pass1") -> None:
    r = client.post(f"{BASE}/register", json={"email": email, "nickname": nick, "password": pw})
    assert r.status_code == 201


def _token(url: str) -> str:
    m = re.search(r"token=([^&]+)", url)
    assert m, f"sin token en {url}"
    return m.group(1)


def test_forgot_sends_link_for_existing_email(client: TestClient, captured: dict) -> None:
    _register(client, "ana@mail.com", "ana")
    r = client.post(f"{BASE}/forgot-password", json={"email": "ana@mail.com"})
    assert r.status_code == 202
    assert captured["to"] == "ana@mail.com"
    assert "token=" in captured["url"]


def test_forgot_unknown_email_no_leak(client: TestClient, captured: dict) -> None:
    r = client.post(f"{BASE}/forgot-password", json={"email": "nadie@mail.com"})
    # Misma respuesta que si existiera, y NO se envía ningún correo.
    assert r.status_code == 202
    assert captured == {}


def test_reset_changes_password_and_is_single_use(client: TestClient, captured: dict) -> None:
    _register(client, "leo@mail.com", "leo", pw="Str0ng!Pass1")
    client.post(f"{BASE}/forgot-password", json={"email": "leo@mail.com"})
    token = _token(captured["url"])

    r = client.post(f"{BASE}/reset-password", json={"token": token, "new_password": "Str0ng!Pass2"})
    assert r.status_code == 204

    # La nueva contraseña funciona; la vieja ya no.
    def login(pw: str) -> int:
        return client.post(
            f"{BASE}/login", json={"identifier": "leo@mail.com", "password": pw}
        ).status_code

    assert login("Str0ng!Pass2") == 200
    assert login("Str0ng!Pass1") == 401

    # El token no vale dos veces.
    r2 = client.post(
        f"{BASE}/reset-password", json={"token": token, "new_password": "Str0ng!Pass3"}
    )
    assert r2.status_code == 400


def test_reset_invalid_token(client: TestClient) -> None:
    r = client.post(
        f"{BASE}/reset-password", json={"token": "no-existe", "new_password": "Str0ng!Pass9"}
    )
    assert r.status_code == 400


def test_reset_rejects_weak_password(client: TestClient, captured: dict) -> None:
    _register(client, "mia@mail.com", "mia")
    client.post(f"{BASE}/forgot-password", json={"email": "mia@mail.com"})
    token = _token(captured["url"])
    r = client.post(f"{BASE}/reset-password", json={"token": token, "new_password": "1234"})
    assert r.status_code == 422  # no cumple la política de contraseña
