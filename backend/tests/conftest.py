"""Fixtures compartidas de los tests."""

from collections.abc import Generator

import pytest
from app.db.session import get_db
from app.main import app
from fastapi.testclient import TestClient


class _FakeSession:
    """Sesión mínima para tests: simula un `execute` correcto sin tocar la DB."""

    def execute(self, *args: object, **kwargs: object) -> None:
        return None


def _override_get_db() -> Generator[_FakeSession, None, None]:
    yield _FakeSession()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
