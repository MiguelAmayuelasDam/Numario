"""Tests de endpoint protegido (`/auth/me`)."""

from fastapi.testclient import TestClient

from tests.conftest import USER_CREDENTIALS

ME = "/api/v1/auth/me"


def test_me_without_token_is_unauthorized(client: TestClient) -> None:
    response = client.get(ME)
    assert response.status_code in {401, 403}


def test_me_with_token_returns_user(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.get(ME, headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == USER_CREDENTIALS["email"]
    assert body["nickname"] == USER_CREDENTIALS["nickname"]


def test_me_with_invalid_token_is_401(client: TestClient) -> None:
    response = client.get(ME, headers={"Authorization": "Bearer invalido"})
    assert response.status_code == 401
