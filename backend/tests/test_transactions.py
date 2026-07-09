"""Tests de movimientos."""

from fastapi.testclient import TestClient

TX = "/api/v1/transactions"
CATEGORIES = "/api/v1/categories"


def _new(concept: str = "Compra", amount: str = "10.00", **extra: object) -> dict:
    base = {"amount": amount, "type": "expense", "concept": concept, "occurred_on": "2026-07-01"}
    base.update(extra)
    return base


def test_requires_authentication(client: TestClient) -> None:
    assert client.get(TX).status_code in {401, 403}
    assert client.post(TX, json=_new()).status_code in {401, 403}


def test_create_transaction(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(TX, headers=auth_headers, json=_new(amount="42.90"))
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["amount"] == "42.90"
    assert body["type"] == "expense"
    assert body["source"] == "manual"
    assert body["category"] is None


def test_create_with_category(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    cat = client.get(CATEGORIES, headers=auth_headers).json()[0]
    response = client.post(TX, headers=auth_headers, json=_new(category_id=cat["id"]))
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["category_id"] == cat["id"]
    assert body["category"]["name"] == cat["name"]


def test_create_amount_not_positive_is_422(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    assert client.post(TX, headers=auth_headers, json=_new(amount="0")).status_code == 422
    assert client.post(TX, headers=auth_headers, json=_new(amount="-5.00")).status_code == 422


def test_create_invalid_type_is_422(client: TestClient, auth_headers: dict[str, str]) -> None:
    assert client.post(TX, headers=auth_headers, json=_new(type="foo")).status_code == 422


def test_create_with_unknown_category_is_422(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    fake = "00000000-0000-0000-0000-000000000000"
    assert client.post(TX, headers=auth_headers, json=_new(category_id=fake)).status_code == 422


def test_list_ordered_recent_first(client: TestClient, auth_headers: dict[str, str]) -> None:
    client.post(TX, headers=auth_headers, json=_new("Antiguo", occurred_on="2026-06-01"))
    client.post(TX, headers=auth_headers, json=_new("Reciente", occurred_on="2026-07-15"))
    client.post(TX, headers=auth_headers, json=_new("Medio", occurred_on="2026-07-01"))
    concepts = [t["concept"] for t in client.get(TX, headers=auth_headers).json()]
    assert concepts == ["Reciente", "Medio", "Antiguo"]


def test_list_filter_by_type(client: TestClient, auth_headers: dict[str, str]) -> None:
    client.post(TX, headers=auth_headers, json=_new("Gasto", type="expense"))
    client.post(TX, headers=auth_headers, json=_new("Ingreso", type="income"))
    incomes = client.get(f"{TX}?type=income", headers=auth_headers).json()
    assert len(incomes) == 1 and incomes[0]["concept"] == "Ingreso"


def test_list_filter_by_date_range(client: TestClient, auth_headers: dict[str, str]) -> None:
    client.post(TX, headers=auth_headers, json=_new("Junio", occurred_on="2026-06-10"))
    client.post(TX, headers=auth_headers, json=_new("Julio", occurred_on="2026-07-10"))
    got = client.get(f"{TX}?from=2026-07-01&to=2026-07-31", headers=auth_headers).json()
    assert [t["concept"] for t in got] == ["Julio"]


def test_get_own_transaction(
    client: TestClient, auth_headers: dict[str, str], sample_transaction: dict
) -> None:
    response = client.get(f"{TX}/{sample_transaction['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["concept"] == "Mercadona"


def test_get_missing_transaction_is_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    fake = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"{TX}/{fake}", headers=auth_headers).status_code == 404


def test_update_transaction(
    client: TestClient, auth_headers: dict[str, str], sample_transaction: dict
) -> None:
    response = client.patch(
        f"{TX}/{sample_transaction['id']}",
        headers=auth_headers,
        json={"concept": "Carrefour", "amount": "55.00"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["concept"] == "Carrefour"
    assert body["amount"] == "55.00"


def test_delete_transaction(
    client: TestClient, auth_headers: dict[str, str], sample_transaction: dict
) -> None:
    assert (
        client.delete(f"{TX}/{sample_transaction['id']}", headers=auth_headers).status_code == 204
    )
    assert client.get(f"{TX}/{sample_transaction['id']}", headers=auth_headers).status_code == 404
