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


def _group(client, headers, name, weight="100", variable_pct="100", fixed_pct="0"):
    return client.post(
        f"{BASE}/groups",
        headers=headers,
        json={
            "name": name,
            "weight": weight,
            "variable_pct": variable_pct,
            "fixed_pct": fixed_pct,
        },
    )


def _in_group(client, headers, name, gid, cls="variable", weight="100"):
    return client.post(
        f"{BASE}/assets",
        headers=headers,
        json={"name": name, "asset_class": cls, "kind": "etf", "weight": weight, "group_id": gid},
    )


def test_month_plan_splits_by_weight(client: TestClient, auth_headers: dict[str, str]) -> None:
    # Un grupo al 100% con split 70/30 y activos de cada clase dentro.
    gid = _group(client, auth_headers, "IB", "100", "70", "30").json()["id"]
    _in_group(client, auth_headers, "ETF World", gid, "variable", "60")
    _in_group(client, auth_headers, "ETF SP", gid, "variable", "40")
    _in_group(client, auth_headers, "Fondo RF", gid, "fija", "100")

    month = client.get(f"{BASE}/month?year=2026&month=7&total=1000", headers=auth_headers).json()
    planned = {m["asset"]["name"]: m["planned"] for m in month}
    assert planned == {"ETF World": "420.00", "ETF SP": "280.00", "Fondo RF": "300.00"}
    assert all(m["done"] is False for m in month)


def test_group_split_plan_matches_excel(client: TestClient, auth_headers: dict[str, str]) -> None:
    """El caso real del autor por la API: 1000 en un grupo (bróker) 100% split 90/10."""
    gid = _group(client, auth_headers, "Interactive Brokers", "100", "90", "10").json()["id"]
    _in_group(client, auth_headers, "SXR8", gid, "variable", "21")
    _in_group(client, auth_headers, "IWDA", gid, "variable", "14")
    _in_group(client, auth_headers, "VHYL", gid, "variable", "12")
    _in_group(client, auth_headers, "VDTA", gid, "fija", "50")
    _in_group(client, auth_headers, "IEAC", gid, "fija", "50")

    month = client.get(f"{BASE}/month?year=2026&month=8&total=1000", headers=auth_headers).json()
    planned = {m["asset"]["name"]: m["planned"] for m in month}
    assert planned["SXR8"] == "189.00"  # 1000 × 100% × 90% × 21%
    assert planned["IWDA"] == "126.00"  # × 14%
    assert planned["VHYL"] == "108.00"  # × 12%
    assert planned["VDTA"] == "50.00"  # 1000 × 100% × 10% × 50%


def test_group_holds_both_classes(client: TestClient, auth_headers: dict[str, str]) -> None:
    # Un grupo (bróker) contiene activos de renta variable Y de renta fija: cada uno
    # conserva su propia clase (etiqueta), que ya no la manda el grupo.
    gid = _group(client, auth_headers, "IB", "100", "90", "10").json()["id"]
    var = _in_group(client, auth_headers, "ETF", gid, "variable", "100").json()
    fija = _in_group(client, auth_headers, "Bono", gid, "fija", "100").json()
    assert var["asset_class"] == "variable"
    assert fija["asset_class"] == "fija"
    assert var["group_id"] == gid and fija["group_id"] == gid


def test_group_split_must_sum_100(client: TestClient, auth_headers: dict[str, str]) -> None:
    r = _group(client, auth_headers, "Mal", "100", "70", "40")
    assert r.status_code == 422


def test_deleting_group_leaves_assets_loose(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    gid = _group(client, auth_headers, "G", "100").json()["id"]
    _in_group(client, auth_headers, "X", gid, "variable", "100")
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
    # Grupos y activos sueltos comparten el 100% del total.
    _group(client, auth_headers, "G1", "70")
    assert _group(client, auth_headers, "G2", "40").status_code == 422
    # El 30 que queda sí cabe (70 + 30 = 100).
    assert _group(client, auth_headers, "G3", "30").status_code == 201


def test_room_is_per_parent(client: TestClient, auth_headers: dict[str, str]) -> None:
    # Dos grupos (50 + 50 = 100 del total), cada uno con su propio 100% interno.
    g1 = _group(client, auth_headers, "G1", "50").json()["id"]
    g2 = _group(client, auth_headers, "G2", "50").json()["id"]

    assert _in_group(client, auth_headers, "a", g1, "variable", "100").status_code == 201
    # g2 tiene su propio 100% interno: un activo al 100% cabe aunque g1 esté lleno.
    assert _in_group(client, auth_headers, "b", g2, "variable", "100").status_code == 201


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


def test_history_and_all_time_total(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    asset_id = _asset(client, auth_headers).json()["id"]
    # Dos aportaciones en meses distintos: la de junio marcada como "extra".
    for amount, day, extra in (("100.00", "2026-06-10", True), ("300.00", "2026-07-10", False)):
        client.post(
            f"{BASE}/contributions",
            headers=auth_headers,
            json={"asset_id": asset_id, "amount": amount, "occurred_on": day, "extra": extra},
        )

    # El histórico las lista de más reciente a más antigua.
    hist = client.get(f"{BASE}/history", headers=auth_headers).json()
    assert [h["occurred_on"] for h in hist] == ["2026-07-10", "2026-06-10"]
    assert hist[0]["amount"] == "300.00"
    # La aportación extra se etiqueta en el concepto.
    assert any(h["concept"].startswith("Aportación extra") for h in hist)
    # Filtrado por activo.
    assert len(client.get(f"{BASE}/history?asset_id={asset_id}", headers=auth_headers).json()) == 2

    # Julio: contributed = 300 (solo el mes), total_contributed = 400 (toda la historia).
    month = client.get(f"{BASE}/month?year=2026&month=7&total=1000", headers=auth_headers).json()
    mine = next(m for m in month if m["asset"]["id"] == asset_id)
    assert mine["contributed"] == "300.00"
    assert mine["total_contributed"] == "400.00"


def test_asset_of_another_user_is_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    # Un uuid que no existe → 404, no 500.
    r = client.patch(
        f"{BASE}/assets/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
        json={"weight": "10"},
    )
    assert r.status_code == 404
