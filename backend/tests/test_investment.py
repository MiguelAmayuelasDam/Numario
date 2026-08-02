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


def _group(client, headers, name, cls="variable", weight="100"):
    return client.post(
        f"{BASE}/groups",
        headers=headers,
        json={"name": name, "asset_class": cls, "weight": weight},
    )


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


def test_three_level_plan_matches_excel(client: TestClient, auth_headers: dict[str, str]) -> None:
    """El caso real del autor por la API: 1000 · 90/10 · variable en dos grupos."""
    client.put(
        f"{BASE}/allocation", headers=auth_headers, json={"variable_pct": 90, "fixed_pct": 10}
    )
    crecimiento = _group(client, auth_headers, "Crecimiento", "variable", "70").json()["id"]
    dividendos = _group(client, auth_headers, "Dividendos", "variable", "30").json()["id"]

    def in_group(name, gid, weight):
        client.post(
            f"{BASE}/assets",
            headers=auth_headers,
            json={"name": name, "asset_class": "variable", "kind": "etf",
                  "weight": weight, "group_id": gid},
        )

    in_group("SXR8", crecimiento, "30")
    in_group("SXRV", crecimiento, "30")
    in_group("IWDA", crecimiento, "20")
    in_group("EMIM", crecimiento, "20")
    in_group("VHYL", dividendos, "40")
    _asset(client, auth_headers, "VDTA", "fija", "fondo", "50")
    _asset(client, auth_headers, "IEAC", "fija", "fondo", "50")

    month = client.get(f"{BASE}/month?year=2026&month=8&total=1000", headers=auth_headers).json()
    planned = {m["asset"]["name"]: m["planned"] for m in month}
    assert planned["SXR8"] == "189.00"  # 1000 × 90% × 70% × 30%
    assert planned["IWDA"] == "126.00"  # × 20%
    assert planned["VHYL"] == "108.00"  # 1000 × 90% × 30% × 40%
    assert planned["VDTA"] == "50.00"  # 1000 × 10% × 50%


def test_asset_in_group_takes_group_class(client: TestClient, auth_headers: dict[str, str]) -> None:
    gid = _group(client, auth_headers, "RF", "fija", "100").json()["id"]
    created = client.post(
        f"{BASE}/assets",
        headers=auth_headers,
        # Aunque diga "variable", al ir a un grupo de renta fija toma su clase.
        json={"name": "Bono", "asset_class": "variable", "kind": "fondo",
              "weight": "100", "group_id": gid},
    ).json()
    assert created["asset_class"] == "fija"
    assert created["group_id"] == gid


def test_deleting_group_leaves_assets_loose(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    gid = _group(client, auth_headers, "G", "variable", "100").json()["id"]
    client.post(
        f"{BASE}/assets",
        headers=auth_headers,
        json={"name": "X", "asset_class": "variable", "kind": "etf",
              "weight": "100", "group_id": gid},
    )
    assert client.delete(f"{BASE}/groups/{gid}", headers=auth_headers).status_code == 204
    # El activo sigue existiendo, ahora sin grupo.
    assets = client.get(f"{BASE}/assets", headers=auth_headers).json()
    assert len(assets) == 1
    assert assets[0]["group_id"] is None


def test_group_of_another_user_is_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    r = client.patch(
        f"{BASE}/groups/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
        json={"weight": "50"},
    )
    assert r.status_code == 404


def test_asset_weights_cannot_exceed_100(client: TestClient, auth_headers: dict[str, str]) -> None:
    _asset(client, auth_headers, "A", "variable", "etf", "70")
    # 70 + 40 = 110 > 100 → rechazado.
    r = _asset(client, auth_headers, "B", "variable", "etf", "40")
    assert r.status_code == 422
    assert "100%" in r.json()["detail"]
    # 30 sí cabe (70 + 30 = 100).
    assert _asset(client, auth_headers, "B", "variable", "etf", "30").status_code == 201


def test_group_weights_cannot_exceed_100(client: TestClient, auth_headers: dict[str, str]) -> None:
    _group(client, auth_headers, "G1", "variable", "70")
    assert _group(client, auth_headers, "G2", "variable", "40").status_code == 422
    # En OTRA clase, el 100% se cuenta aparte.
    assert _group(client, auth_headers, "GF", "fija", "100").status_code == 201


def test_room_is_per_parent(client: TestClient, auth_headers: dict[str, str]) -> None:
    # Dos grupos, cada uno con sus propios 100% de margen interno.
    g1 = _group(client, auth_headers, "G1", "variable", "50").json()["id"]
    g2 = _group(client, auth_headers, "G2", "variable", "50").json()["id"]

    def in_g(name, gid, weight):
        return client.post(
            f"{BASE}/assets",
            headers=auth_headers,
            json={"name": name, "asset_class": "variable", "kind": "etf",
                  "weight": weight, "group_id": gid},
        )

    assert in_g("a", g1, "100").status_code == 201
    # g2 tiene su propio 100%: un activo al 100% cabe aunque g1 esté lleno.
    assert in_g("b", g2, "100").status_code == 201


def test_editing_weight_excludes_self(client: TestClient, auth_headers: dict[str, str]) -> None:
    # Un solo activo al 60%: subirlo al 90% debe caber (no cuenta consigo mismo).
    aid = _asset(client, auth_headers, "A", "variable", "etf", "60").json()["id"]
    r = client.patch(f"{BASE}/assets/{aid}", headers=auth_headers, json={"weight": "90"})
    assert r.status_code == 200
    assert r.json()["weight"] == "90.00"


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
