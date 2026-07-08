"""Tests del endpoint de login."""

from fastapi.testclient import TestClient

from tests.conftest import USER_CREDENTIALS

LOGIN = "/api/v1/auth/login"


def test_login_by_email_ok(client: TestClient, registered_user: dict[str, str]) -> None:
    response = client.post(
        LOGIN,
        json={
            "identifier": USER_CREDENTIALS["email"],
            "password": USER_CREDENTIALS["password"],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_login_by_nickname_ok(client: TestClient, registered_user: dict[str, str]) -> None:
    response = client.post(
        LOGIN,
        json={"identifier": USER_CREDENTIALS["nickname"], "password": USER_CREDENTIALS["password"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["access_token"]


def test_login_is_case_insensitive_on_identifier(
    client: TestClient, registered_user: dict[str, str]
) -> None:
    response = client.post(
        LOGIN, json={"identifier": "USER@MAIL.COM", "password": USER_CREDENTIALS["password"]}
    )
    assert response.status_code == 200


def test_login_wrong_password_is_401(client: TestClient, registered_user: dict[str, str]) -> None:
    response = client.post(
        LOGIN, json={"identifier": USER_CREDENTIALS["email"], "password": "Wr0ng!Pass"}
    )
    assert response.status_code == 401


def test_login_unknown_user_is_401(client: TestClient) -> None:
    response = client.post(LOGIN, json={"identifier": "nadie@mail.com", "password": "Wr0ng!Pass"})
    assert response.status_code == 401
