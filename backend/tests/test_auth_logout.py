"""Tests del endpoint de logout."""

from fastapi.testclient import TestClient

LOGOUT = "/api/v1/auth/logout"
REFRESH = "/api/v1/auth/refresh"


def test_logout_revokes_refresh_token(
    client: TestClient, tokens: dict[str, str], auth_headers: dict[str, str]
) -> None:
    response = client.post(
        LOGOUT, json={"refresh_token": tokens["refresh_token"]}, headers=auth_headers
    )
    assert response.status_code == 204
    # Tras el logout, el refresh ya no vale.
    reuse = client.post(REFRESH, json={"refresh_token": tokens["refresh_token"]})
    assert reuse.status_code == 401


def test_logout_requires_authentication(client: TestClient, tokens: dict[str, str]) -> None:
    response = client.post(LOGOUT, json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code in {401, 403}
