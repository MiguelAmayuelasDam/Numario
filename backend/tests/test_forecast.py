"""Tests del previsto por categoría."""

from fastapi.testclient import TestClient

FORECAST = "/api/v1/forecast"
PAST_OVERVIEW = "/api/v1/analytics/overview?granularity=month&year=2025&month=1"


def _cat(client, headers, name):
    cats = client.get("/api/v1/categories", headers=headers).json()
    return next(c["id"] for c in cats if c["name"] == name)


def test_requires_auth(client: TestClient) -> None:
    resp = client.put(FORECAST, json={"category_id": "x", "amount": "10.00"})
    assert resp.status_code in {401, 403, 422}


def test_set_and_read_forecast(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    resta = _cat(client, auth_headers, "Restaurante")
    resp = client.put(
        FORECAST, headers=auth_headers, json={"category_id": resta, "amount": "50.00"}
    )
    assert resp.status_code == 204

    # En el mes en curso, el overview trae la lista con previsto.
    from datetime import date

    today = date.today()
    ov = client.get(
        f"/api/v1/analytics/overview?granularity=month&year={today.year}&month={today.month}",
        headers=auth_headers,
    ).json()
    assert ov["is_current"] is True
    resta_row = next(c for c in ov["categories"] if c["name"] == "Restaurante")
    assert resta_row["forecast"] == "50.00"


def test_forecast_zero_deletes(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    resta = _cat(client, auth_headers, "Restaurante")
    client.put(FORECAST, headers=auth_headers, json={"category_id": resta, "amount": "50.00"})
    client.put(FORECAST, headers=auth_headers, json={"category_id": resta, "amount": "0"})

    from datetime import date

    today = date.today()
    ov = client.get(
        f"/api/v1/analytics/overview?granularity=month&year={today.year}&month={today.month}",
        headers=auth_headers,
    ).json()
    resta_row = next((c for c in ov["categories"] if c["name"] == "Restaurante"), None)
    # Sigue apareciendo (categoría común) pero sin previsto.
    assert resta_row is None or resta_row["forecast"] is None


def test_past_month_has_no_forecast(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    body = client.get(PAST_OVERVIEW, headers=auth_headers).json()  # enero 2025 (pasado)
    assert body["is_current"] is False
    assert all(c["forecast"] is None for c in body["categories"])


def test_current_month_lists_common_categories(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    from datetime import date

    today = date.today()
    ov = client.get(
        f"/api/v1/analytics/overview?granularity=month&year={today.year}&month={today.month}",
        headers=auth_headers,
    ).json()
    names = {c["name"] for c in ov["categories"]}
    # Sin movimientos, aún ofrece categorías comunes para planificar.
    assert "Supermercado" in names
    assert "Restaurante" in names
