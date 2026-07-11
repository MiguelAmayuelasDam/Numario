"""Tests de la analítica (resumen, cubos 50-30-20, categorías, series)."""

from fastapi.testclient import TestClient

TX = "/api/v1/transactions"
OVERVIEW = "/api/v1/analytics/overview?granularity=month&year=2026&month=7"


def _mk(client, headers, amount, type_, concept, category=None, date_="2026-07-05"):
    body = {"amount": amount, "type": type_, "concept": concept, "occurred_on": date_}
    if category:
        body["category_id"] = category
    return client.post(TX, headers=headers, json=body)


def _cat(client, headers, name):
    cats = client.get("/api/v1/categories", headers=headers).json()
    return next(c["id"] for c in cats if c["name"] == name)


def test_requires_auth(client: TestClient) -> None:
    assert client.get(OVERVIEW).status_code in {401, 403}


def test_summary_excludes_transfer(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    _mk(client, auth_headers, "1000.00", "income", "Nomina")
    _mk(client, auth_headers, "300.00", "expense", "Compra")
    _mk(client, auth_headers, "500.00", "transfer", "Traspaso")  # no computable

    summary = client.get(OVERVIEW, headers=auth_headers).json()["summary"]
    assert summary["income"] == "1000.00"
    assert summary["expense"] == "300.00"
    assert summary["net"] == "700.00"  # el transfer no cuenta


def test_buckets_budget_and_spent(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    client.put(
        "/api/v1/budget",
        headers=auth_headers,
        json={
            "monthly_income": "1000.00",
            "living_pct": 50,
            "monthly_pct": 30,
            "investment_pct": 20,
        },
    )
    superm = _cat(client, auth_headers, "Supermercado")
    resta = _cat(client, auth_headers, "Restaurante")
    _mk(client, auth_headers, "100.00", "expense", "Super", superm)
    _mk(client, auth_headers, "60.00", "expense", "Cena", resta)

    buckets = {b["bucket"]: b for b in client.get(OVERVIEW, headers=auth_headers).json()["buckets"]}
    assert buckets["living"]["budget"] == "500.00"  # 1000 * 50%
    assert buckets["living"]["spent"] == "100.00"
    assert buckets["living"]["status"] == "ok"
    assert buckets["monthly"]["budget"] == "300.00"
    assert buckets["monthly"]["spent"] == "60.00"
    assert buckets["investment"]["spent"] == "0.00"


def test_by_category_sorted_desc(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    superm = _cat(client, auth_headers, "Supermercado")
    resta = _cat(client, auth_headers, "Restaurante")
    _mk(client, auth_headers, "100.00", "expense", "Super", superm)
    _mk(client, auth_headers, "200.00", "expense", "Cena", resta)

    categories = client.get(OVERVIEW, headers=auth_headers).json()["categories"]
    assert categories[0]["spent"] == "200.00"
    assert categories[0]["name"] == "Restaurante"


def test_series_returns_points(client: TestClient, auth_headers: dict[str, str]) -> None:
    points = client.get(
        "/api/v1/analytics/series?granularity=month&count=6", headers=auth_headers
    ).json()
    assert len(points) == 6
    assert all("income" in p and "expense" in p for p in points)
