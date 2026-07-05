"""Tests del endpoint /health."""

from fastapi.testclient import TestClient


def test_health_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    # La conexión a la DB puede no estar disponible en un entorno sin Postgres;
    # el endpoint debe reportarlo sin romper.
    assert body["db"] in {"ok", "error"}
