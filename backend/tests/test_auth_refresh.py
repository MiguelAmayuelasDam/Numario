"""Tests del endpoint de refresh (rotación de tokens)."""

from fastapi.testclient import TestClient

REFRESH = "/api/v1/auth/refresh"


def test_refresh_returns_new_pair(client: TestClient, tokens: dict[str, str]) -> None:
    response = client.post(REFRESH, json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    # El refresh rotado debe ser distinto del original.
    assert body["refresh_token"] != tokens["refresh_token"]


def test_old_refresh_is_revoked_after_rotation(
    client: TestClient, tokens: dict[str, str]
) -> None:
    first = client.post(REFRESH, json={"refresh_token": tokens["refresh_token"]})
    assert first.status_code == 200
    # Reutilizar el refresh antiguo ya rotado → 401.
    reuse = client.post(REFRESH, json={"refresh_token": tokens["refresh_token"]})
    assert reuse.status_code == 401


def test_refresh_with_garbage_is_401(client: TestClient) -> None:
    response = client.post(REFRESH, json={"refresh_token": "no-existe"})
    assert response.status_code == 401
