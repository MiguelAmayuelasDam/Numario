"""Tests de la API de la cartera de inversión."""

from fastapi.testclient import TestClient

BASE = "/api/v1/investment"


def _asset(client, headers, name="ETF World", cls="variable", kind="etf", weight="100"):
    return client.post(
        f"{BASE}/assets",
        headers=headers,
        json={"name": name, "asset_class": cls, "kind": kind, "weight": weight},
    )


def test_requires_auth(client: TestClient) -> None:
    assert client.get(f"{BASE}/assets").status_code in {401, 403}


def test_allocation_default_is_all_variable(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    body = client.get(f"{BASE}/allocation", headers=auth_headers).json()
    assert body == {"variable_pct": 100, "fixed_pct": 0}


def test_allocation_must_sum_100(client: TestClient, auth_headers: dict[str, str]) -> None:
    r = client.put(
        f"{BASE}/allocation", headers=auth_headers, json={"variable_pct": 70, "fixed_pct": 40}
    )
    assert r.status_code == 422


def test_create_and_list_asset(client: TestClient, auth_headers: dict[str, str]) -> None:
    created = _asset(client, auth_headers)
    assert created.status_code == 201
    assert created.json()["name"] == "ETF World"

    listed = client.get(f"{BASE}/assets", headers=auth_headers).json()
    assert len(listed) == 1
    assert listed[0]["asset_class"] == "variable"


def test_invalid_kind_rejected(client: TestClient, auth_headers: dict[str, str]) -> None:
    r = _asset(client, auth_headers, kind="nft")
    assert r.status_code == 422


def test_update_and_archive_asset(client: TestClient, auth_headers: dict[str, str]) -> None:
    asset_id = _asset(client, auth_headers).json()["id"]

    upd = client.patch(f"{BASE}/assets/{asset_id}", headers=auth_headers, json={"weight": "50"})
    assert upd.json()["weight"] == "50.00"

    client.patch(f"{BASE}/assets/{asset_id}", headers=auth_headers, json={"active": False})
    # Archivado: no sale en el listado normal, sí con include_archived.
    assert client.get(f"{BASE}/assets", headers=auth_headers).json() == []
    assert len(client.get(f"{BASE}/assets?include_archived=true", headers=auth_headers).json()) == 1


def test_month_plan_splits_by_weight(client: TestClient, auth_headers: dict[str, str]) -> None:
    client.put(
        f"{BASE}/allocation", headers=auth_headers, json={"variable_pct": 70, "fixed_pct": 30}
    )
    _asset(client, auth_headers, "ETF World", "variable", "etf", "60")
    _asset(client, auth_headers, "ETF SP", "variable", "etf", "40")
    _asset(client, auth_headers, "Fondo RF", "fija", "fondo", "100")

    month = client.get(f"{BASE}/month?year=2026&month=7&total=1000", headers=auth_headers).json()
    planned = {m["asset"]["name"]: m["planned"] for m in month}
    assert planned == {"ETF World": "420.00", "ETF SP": "280.00", "Fondo RF": "300.00"}
    assert all(m["done"] is False for m in month)


def test_contribution_creates_movement_and_marks_done(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    asset_id = _asset(client, auth_headers).json()["id"]

    contrib = client.post(
        f"{BASE}/contributions",
        headers=auth_headers,
        json={"asset_id": asset_id, "amount": "300.00", "occurred_on": "2026-07-10"},
    )
    assert contrib.status_code == 201
    # La aportación es un traspaso (no computable) con la categoría Inversiones.
    assert contrib.json()["type"] == "transfer"

    # Aparece en los movimientos.
    txs = client.get("/api/v1/transactions", headers=auth_headers).json()
    assert any(t["amount"] == "300.00" for t in txs)

    # Y el activo queda marcado como hecho ese mes.
    month = client.get(f"{BASE}/month?year=2026&month=7&total=1000", headers=auth_headers).json()
    mine = next(m for m in month if m["asset"]["id"] == asset_id)
    assert mine["done"] is True
    assert mine["contributed"] == "300.00"


def test_contribution_feeds_investment_bucket(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    """La aportación debe alimentar el cubo Inversión del 50-30-20, no romperlo."""
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
    asset_id = _asset(client, auth_headers).json()["id"]
    client.post(
        f"{BASE}/contributions",
        headers=auth_headers,
        json={"asset_id": asset_id, "amount": "150.00", "occurred_on": "2026-07-10"},
    )

    overview = client.get(
        "/api/v1/analytics/overview?granularity=month&year=2026&month=7", headers=auth_headers
    ).json()
    invest = next(b for b in overview["buckets"] if b["bucket"] == "investment")
    assert invest["spent"] == "150.00"  # la aportación cuenta en el cubo


def test_undo_contribution(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    asset_id = _asset(client, auth_headers).json()["id"]
    client.post(
        f"{BASE}/contributions",
        headers=auth_headers,
        json={"asset_id": asset_id, "amount": "300.00", "occurred_on": "2026-07-10"},
    )

    r = client.delete(
        f"{BASE}/contributions?asset_id={asset_id}&year=2026&month=7", headers=auth_headers
    )
    assert r.status_code == 204

    month = client.get(f"{BASE}/month?year=2026&month=7&total=1000", headers=auth_headers).json()
    assert next(m for m in month if m["asset"]["id"] == asset_id)["done"] is False


def test_asset_of_another_user_is_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    # Un uuid que no existe → 404, no 500.
    r = client.patch(
        f"{BASE}/assets/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
        json={"weight": "10"},
    )
    assert r.status_code == 404
