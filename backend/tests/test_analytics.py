"""Tests de la analítica (resumen, cubos 50-30-20, categorías, series)."""

from datetime import date

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


def test_overview_all_aggregates_everything(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    """La vista 'Todo' suma todos los movimientos (cualquier mes/año) y usa como
    base del 50-30-20 la suma de todos los ingresos."""
    client.put(
        "/api/v1/budget",
        headers=auth_headers,
        json={"monthly_income": "1.00", "living_pct": 50, "monthly_pct": 30, "investment_pct": 20},
    )
    _mk(client, auth_headers, "1000.00", "income", "Nómina ene", date_="2025-01-31")
    _mk(client, auth_headers, "500.00", "income", "Nómina jul", date_="2026-07-05")
    superm = _cat(client, auth_headers, "Supermercado")
    _mk(client, auth_headers, "200.00", "expense", "Super 2025", superm, date_="2025-03-15")
    _mk(client, auth_headers, "100.00", "expense", "Super 2026", superm, date_="2026-07-05")

    ov = client.get("/api/v1/analytics/overview?granularity=all", headers=auth_headers).json()
    assert ov["period_label"] == "Todo"
    assert ov["summary"]["income"] == "1500.00"  # suma de todos los ingresos
    assert ov["summary"]["expense"] == "300.00"  # suma de todos los gastos
    assert ov["summary"]["net"] == "1200.00"
    living = next(b for b in ov["buckets"] if b["bucket"] == "living")
    assert living["budget"] == "750.00"  # 1500 (base = todos los ingresos) × 50%
    assert living["spent"] == "300.00"  # todo el gasto de Supermercado (cubo Vida)


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


def test_buckets_unset_when_no_income_configured(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    """Sin ingreso configurado el semáforo no puede opinar, y debe decirlo.

    Es el estado de un usuario recién registrado que ya ha metido gastos: antes
    caía en `ok` y la aplicación afirmaba que iba bien sin nada con lo que
    comparar.
    """
    superm = _cat(client, auth_headers, "Supermercado")
    _mk(client, auth_headers, "2000.00", "expense", "Compra enorme", superm)

    buckets = {b["bucket"]: b for b in client.get(OVERVIEW, headers=auth_headers).json()["buckets"]}
    assert buckets["living"]["budget"] == "0.00"
    assert buckets["living"]["spent"] == "2000.00"
    assert buckets["living"]["status"] == "unset"  # no "ok": no se sabe
    assert buckets["living"]["pct"] == 0
    # Los cubos sin gasto tampoco opinan.
    assert buckets["monthly"]["status"] == "unset"
    assert buckets["investment"]["status"] == "unset"


def test_buckets_leave_unset_as_soon_as_there_is_income(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    """En cuanto hay ingreso configurado, el semáforo vuelve a opinar."""
    superm = _cat(client, auth_headers, "Supermercado")
    _mk(client, auth_headers, "600.00", "expense", "Compra", superm)

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

    buckets = {b["bucket"]: b for b in client.get(OVERVIEW, headers=auth_headers).json()["buckets"]}
    assert buckets["living"]["budget"] == "500.00"
    assert buckets["living"]["status"] == "over"  # 600 de 500 → 120%
    assert buckets["living"]["pct"] == 120


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


def test_series_month_returns_12_of_year(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    points = client.get(
        "/api/v1/analytics/series?granularity=month&year=2025", headers=auth_headers
    ).json()
    assert len(points) == 12
    assert points[0]["month"] == 1 and points[0]["year"] == 2025
    assert points[-1]["month"] == 12


def test_series_year_window(client: TestClient, auth_headers: dict[str, str]) -> None:
    points = client.get(
        "/api/v1/analytics/series?granularity=year&year=2026&count=4", headers=auth_headers
    ).json()
    assert [p["year"] for p in points] == [2023, 2024, 2025, 2026]


def test_recent_ends_in_current_month(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    points = client.get("/api/v1/analytics/recent?months=6", headers=auth_headers).json()
    assert len(points) == 6
    today = date.today()
    # El último punto es el mes en curso; la ventana rueda entre años.
    assert points[-1]["year"] == today.year
    assert points[-1]["month"] == today.month


def test_investment_transfer_counts_in_bucket(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    # Una inversión registrada como "No computable" (transfer) debe contar en el
    # cubo de inversión, aunque NO cuente en gastos/neto.
    inv = _cat(client, auth_headers, "Inversiones")
    _mk(client, auth_headers, "200.00", "transfer", "Broker", inv)

    body = client.get(OVERVIEW, headers=auth_headers).json()
    buckets = {b["bucket"]: b for b in body["buckets"]}
    assert buckets["investment"]["spent"] == "200.00"
    # No cuenta en gastos ni en el neto.
    assert body["summary"]["expense"] == "0.00"
