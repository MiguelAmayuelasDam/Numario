"""Test del rate limiting en login."""

import pytest
from app.core.config import settings
from app.core.rate_limit import limiter
from fastapi.testclient import TestClient

LOGIN = "/api/v1/auth/login"


@pytest.fixture
def _enable_rate_limit() -> None:
    limiter.enabled = True
    limiter.reset()


def test_login_rate_limited_after_threshold(
    client: TestClient,
    registered_user: dict[str, str],
    _enable_rate_limit: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Umbral fijado por el test para no depender del valor del entorno (que en
    # dev/E2E está relajado). El login lee el límite de forma dinámica.
    monkeypatch.setattr(settings, "rate_limit_login", "5/minute")
    payload = {"identifier": registered_user["email"], "password": "Wr0ng!Pass"}
    statuses = [client.post(LOGIN, json=payload).status_code for _ in range(7)]
    # Con 5/minuto, al superar el umbral al menos una respuesta debe ser 429.
    assert 429 in statuses
