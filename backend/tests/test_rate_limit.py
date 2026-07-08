"""Test del rate limiting en login."""

import pytest
from app.core.rate_limit import limiter
from fastapi.testclient import TestClient

LOGIN = "/api/v1/auth/login"


@pytest.fixture
def _enable_rate_limit() -> None:
    limiter.enabled = True
    limiter.reset()


def test_login_rate_limited_after_threshold(
    client: TestClient, registered_user: dict[str, str], _enable_rate_limit: None
) -> None:
    payload = {"identifier": registered_user["email"], "password": "Wr0ng!Pass"}
    statuses = [client.post(LOGIN, json=payload).status_code for _ in range(7)]
    # El límite por defecto es 5/minuto: al menos una respuesta debe ser 429.
    assert 429 in statuses
