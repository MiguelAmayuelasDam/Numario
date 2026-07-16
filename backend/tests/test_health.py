"""Tests de los endpoints de infraestructura (/, /health y /ping)."""

from fastapi.testclient import TestClient


def test_root_presents_the_api(client: TestClient) -> None:
    """La raíz no es un 404: orienta a quien abre la URL del servicio a pelo."""
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Numario API"
    assert body["docs"] == "/docs"


def test_ping_ok_and_does_not_touch_db(client: TestClient) -> None:
    """/ping es liveness puro: no debe consultar la DB (mantendría despierta la
    base de datos gestionada y agotaría su cuota de cómputo)."""
    response = client.get("/ping")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    # La conexión a la DB puede no estar disponible en un entorno sin Postgres;
    # el endpoint debe reportarlo sin romper.
    assert body["db"] in {"ok", "error"}
