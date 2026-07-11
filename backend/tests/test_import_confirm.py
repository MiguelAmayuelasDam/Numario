"""Tests de la confirmación de importación (`/import/confirm`)."""

from pathlib import Path

from fastapi.testclient import TestClient

CONFIRM = "/api/v1/import/confirm"
PREVIEW = "/api/v1/import/preview"
TX = "/api/v1/transactions"
FIXTURE = Path(__file__).parent / "fixtures" / "imagin_sample.csv"


def _category_id(client: TestClient, headers: dict[str, str], name: str) -> str:
    cats = client.get("/api/v1/categories", headers=headers).json()
    return next(c["id"] for c in cats if c["name"] == name)


def test_confirm_persists_as_import(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    items = [
        {
            "amount": "6.40",
            "type": "expense",
            "concept": "BAR FETICHE",
            "occurred_on": "2026-07-10",
        },
        {
            "amount": "13.18",
            "type": "expense",
            "concept": "MERCADONA JULIAN",
            "occurred_on": "2026-06-24",
        },
    ]
    response = client.post(CONFIRM, headers=auth_headers, json={"items": items})
    assert response.status_code == 201, response.text
    assert response.json()["created"] == 2

    txs = client.get(TX, headers=auth_headers).json()
    assert len(txs) == 2
    assert all(t["source"] == "import_csv" for t in txs)


def test_confirm_learns_from_correction(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    # KONOGAN no se clasifica de serie; el usuario lo marca como Restaurante.
    restaurante = _category_id(client, auth_headers, "Restaurante")
    client.post(
        CONFIRM,
        headers=auth_headers,
        json={
            "items": [
                {
                    "amount": "7.70",
                    "type": "expense",
                    "concept": "KONOGAN",
                    "occurred_on": "2026-07-03",
                    "category_id": restaurante,
                }
            ]
        },
    )

    # Una nueva preview ya sugiere Restaurante (regla aprendida).
    raw = FIXTURE.read_bytes()
    body = client.post(
        PREVIEW, headers=auth_headers, files={"file": ("e.csv", raw, "text/csv")}
    ).json()
    konogan = next(r for r in body["rows"] if r["concept"] == "KONOGAN")
    assert konogan["source"] == "learned"
    assert konogan["category"]["name"] == "Restaurante"


def test_confirm_rejects_foreign_category(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    fake = "00000000-0000-0000-0000-000000000000"
    response = client.post(
        CONFIRM,
        headers=auth_headers,
        json={
            "items": [
                {
                    "amount": "5.00",
                    "type": "expense",
                    "concept": "X",
                    "occurred_on": "2026-07-01",
                    "category_id": fake,
                }
            ]
        },
    )
    assert response.status_code == 422
