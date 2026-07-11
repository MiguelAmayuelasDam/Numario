"""Tests de la previsualización de importación (`/import/preview`)."""

from pathlib import Path

from fastapi.testclient import TestClient

PREVIEW = "/api/v1/import/preview"
FIXTURE = Path(__file__).parent / "fixtures" / "imagin_sample.csv"


def _upload(client: TestClient, headers: dict[str, str], data: bytes | None = None):
    raw = data if data is not None else FIXTURE.read_bytes()
    return client.post(PREVIEW, headers=headers, files={"file": ("extracto.csv", raw, "text/csv")})


def test_preview_requires_auth(client: TestClient) -> None:
    response = client.post(PREVIEW, files={"file": ("x.csv", b"a", "text/csv")})
    assert response.status_code in {401, 403}


def test_preview_classifies_rows(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    response = _upload(client, auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["summary"]["total"] == 8
    assert body["summary"]["classified"] >= 6

    by_concept = {r["concept"]: r for r in body["rows"]}
    assert by_concept["MERCADONA JULIAN"]["category"]["name"] == "Supermercado"
    assert by_concept["MERCADONA JULIAN"]["source"] == "rule"
    assert by_concept["WWW.AMAZON* YR49O"]["category"]["name"] == "Otras compras"
    # KONOGAN no tiene regla → a revisar.
    assert by_concept["KONOGAN"]["category"] is None
    # El importe viaja como string y positivo.
    assert by_concept["BAR FETICHE"]["amount"] == "6.40"
    assert by_concept["BAR FETICHE"]["type"] == "expense"
    # El traspaso es no computable.
    assert by_concept["Traspaso del pago"]["type"] == "transfer"


def test_preview_marks_duplicates(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    # Creamos un movimiento idéntico a una fila del CSV.
    client.post(
        "/api/v1/transactions",
        headers=auth_headers,
        json={
            "amount": "6.40",
            "type": "expense",
            "concept": "BAR FETICHE",
            "occurred_on": "2026-07-10",
        },
    )
    body = _upload(client, auth_headers).json()
    assert body["summary"]["duplicates"] == 1
    dup = next(r for r in body["rows"] if r["concept"] == "BAR FETICHE")
    assert dup["duplicate"] is True


def test_preview_reports_errors(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    csv = b"Concepto;Fecha;Importe;Saldo\nOK;01/07/2026;-5,00EUR;1,00EUR\nMAL;xx;-5,00EUR;1,00EUR\n"
    body = _upload(client, auth_headers, data=csv).json()
    assert body["summary"]["total"] == 1
    assert body["summary"]["errors"] == 1
    assert body["error_details"]
