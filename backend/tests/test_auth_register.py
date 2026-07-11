"""Tests del endpoint de registro."""

from app.core.password_policy import COMMON_PASSWORDS
from fastapi.testclient import TestClient

from tests.conftest import USER_CREDENTIALS

REGISTER = "/api/v1/auth/register"


def test_register_created(client: TestClient) -> None:
    response = client.post(REGISTER, json=USER_CREDENTIALS)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == USER_CREDENTIALS["email"]
    assert body["nickname"] == USER_CREDENTIALS["nickname"]
    assert "id" in body
    assert "password" not in body and "password_hash" not in body


def test_register_normalizes_email_and_nickname(client: TestClient) -> None:
    payload = {**USER_CREDENTIALS, "email": "MixedCase@Mail.com", "nickname": "MiNick"}
    response = client.post(REGISTER, json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "mixedcase@mail.com"
    assert body["nickname"] == "minick"


def test_register_duplicate_email_conflict(client: TestClient) -> None:
    client.post(REGISTER, json=USER_CREDENTIALS)
    dup = {**USER_CREDENTIALS, "nickname": "otronick"}
    response = client.post(REGISTER, json=dup)
    assert response.status_code == 409
    assert "email" in response.json()["detail"].lower()


def test_register_duplicate_nickname_conflict(client: TestClient) -> None:
    client.post(REGISTER, json=USER_CREDENTIALS)
    dup = {**USER_CREDENTIALS, "email": "other@mail.com"}
    response = client.post(REGISTER, json=dup)
    assert response.status_code == 409
    assert "nick" in response.json()["detail"].lower()


def test_register_missing_nickname_is_422(client: TestClient) -> None:
    payload = {"email": USER_CREDENTIALS["email"], "password": USER_CREDENTIALS["password"]}
    response = client.post(REGISTER, json=payload)
    assert response.status_code == 422


def test_register_invalid_email_is_422(client: TestClient) -> None:
    payload = {**USER_CREDENTIALS, "email": "no-es-email"}
    response = client.post(REGISTER, json=payload)
    assert response.status_code == 422


def test_register_weak_password_is_422(client: TestClient) -> None:
    payload = {**USER_CREDENTIALS, "password": "weak"}
    response = client.post(REGISTER, json=payload)
    assert response.status_code == 422


def test_register_common_password_is_422(client: TestClient) -> None:
    assert "password123" in COMMON_PASSWORDS
    payload = {**USER_CREDENTIALS, "password": "password123"}
    response = client.post(REGISTER, json=payload)
    assert response.status_code == 422


def test_register_invalid_nickname_pattern_is_422(client: TestClient) -> None:
    payload = {**USER_CREDENTIALS, "nickname": "espacios prohibidos"}
    response = client.post(REGISTER, json=payload)
    assert response.status_code == 422


def test_register_accepts_accented_nickname(client: TestClient) -> None:
    # Tildes y ñ deben aceptarse (caracteres del español).
    payload = {**USER_CREDENTIALS, "nickname": "Jośé_Muñoz"}
    response = client.post(REGISTER, json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["nickname"] == "jośé_muñoz"
