"""Los importes deben conservar la precisión (Decimal, nunca float)."""

from decimal import Decimal

from fastapi.testclient import TestClient

TX = "/api/v1/transactions"


def test_amount_roundtrips_as_string(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        TX,
        headers=auth_headers,
        json={"amount": "42.90", "type": "expense", "concept": "X", "occurred_on": "2026-07-01"},
    )
    assert response.status_code == 201
    # Se devuelve como string, no como float.
    assert response.json()["amount"] == "42.90"
    raw = response.text
    assert '"amount":"42.90"' in raw.replace(" ", "")


def test_amount_no_float_rounding_error(client: TestClient, auth_headers: dict[str, str]) -> None:
    # 0.1 + 0.2 en float daría 0.30000000000000004; con Decimal debe ser exacto.
    for value in ["0.10", "0.20", "1234567890.99"]:
        response = client.post(
            TX,
            headers=auth_headers,
            json={"amount": value, "type": "income", "concept": "C", "occurred_on": "2026-07-01"},
        )
        assert response.status_code == 201, response.text
        assert Decimal(response.json()["amount"]) == Decimal(value)


def test_amount_is_quantized_to_two_decimals(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        TX,
        headers=auth_headers,
        json={"amount": "10.5", "type": "expense", "concept": "C", "occurred_on": "2026-07-01"},
    )
    assert response.status_code == 201
    assert response.json()["amount"] == "10.50"
