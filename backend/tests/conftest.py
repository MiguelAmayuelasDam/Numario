"""Fixtures compartidas de los tests.

Se usa **SQLite en memoria** (con `StaticPool` para compartir la misma conexión
entre el test y el cliente HTTP) de modo que la suite de auth corre sin Postgres.
El rate limiter se deshabilita por defecto y se activa solo donde se prueba.
"""

from collections.abc import Generator

import pytest
from app.core.rate_limit import limiter
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Nota: importar `app.main` ya registra todos los modelos en `Base.metadata`
# (main → router v1 → servicio → modelos), así que no hace falta importarlos
# aparte (además, `import app.models` re-vincularía el nombre `app`).

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


# Contraseña fuerte reutilizable en los tests (cumple la política).
STRONG_PASSWORD = "Str0ng!Pass"
USER_CREDENTIALS = {
    "email": "user@mail.com",
    "nickname": "usuario",
    "password": STRONG_PASSWORD,
}


@pytest.fixture(autouse=True)
def _disable_rate_limit() -> Generator[None, None, None]:
    """Por defecto el limiter está apagado; el test de rate limit lo reactiva."""
    limiter.enabled = False
    yield
    limiter.enabled = False


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def registered_user(client: TestClient) -> dict[str, str]:
    """Registra un usuario y devuelve sus credenciales."""
    response = client.post("/api/v1/auth/register", json=USER_CREDENTIALS)
    assert response.status_code == 201, response.text
    return dict(USER_CREDENTIALS)


@pytest.fixture
def tokens(client: TestClient, registered_user: dict[str, str]) -> dict[str, str]:
    """Devuelve un par de tokens (login con el usuario registrado)."""
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": registered_user["email"], "password": registered_user["password"]},
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def auth_headers(tokens: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def seed_categories(db_session: Session) -> None:
    """Siembra las categorías globales por defecto (como hace la migración 0004).

    Los tests usan `create_all`, no las migraciones, así que hay que insertarlas
    aquí reutilizando la misma fuente de verdad.
    """
    from app.db.default_categories import DEFAULT_CATEGORIES
    from app.models.category import Category

    db_session.add_all(
        Category(user_id=None, name=name, bucket=bucket, emoji=emoji, is_default=True)
        for name, bucket, emoji in DEFAULT_CATEGORIES
    )
    db_session.commit()


@pytest.fixture
def sample_transaction(client: TestClient, auth_headers: dict[str, str]) -> dict[str, object]:
    """Crea un movimiento y devuelve su representación JSON."""
    response = client.post(
        "/api/v1/transactions",
        headers=auth_headers,
        json={
            "amount": "42.90",
            "type": "expense",
            "concept": "Mercadona",
            "occurred_on": "2026-07-03",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
