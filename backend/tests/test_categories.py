"""Tests de categorías."""

from fastapi.testclient import TestClient

CATEGORIES = "/api/v1/categories"


def test_list_includes_default_categories(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    response = client.get(CATEGORIES, headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) >= 79
    assert all("bucket" in c and "name" in c for c in body)
    assert any(c["name"] == "Supermercado" and c["bucket"] == "living" for c in body)
    # No computable → bucket transfer.
    assert any(
        c["name"] == "Traspasos y transferencias" and c["bucket"] == "transfer" for c in body
    )
    # Las categorías por defecto traen emoji.
    supermercado = next(c for c in body if c["name"] == "Supermercado")
    assert supermercado["emoji"] == "🛒"
    assert all(c["is_default"] for c in body)


def test_requires_authentication(client: TestClient) -> None:
    assert client.get(CATEGORIES).status_code in {401, 403}


def test_create_own_category(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        CATEGORIES, headers=auth_headers, json={"name": "Mascotas", "bucket": "monthly"}
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Mascotas"
    assert body["bucket"] == "monthly"
    assert body["is_default"] is False


def test_create_duplicate_name_conflict(client: TestClient, auth_headers: dict[str, str]) -> None:
    payload = {"name": "Mascotas", "bucket": "monthly"}
    client.post(CATEGORIES, headers=auth_headers, json=payload)
    response = client.post(CATEGORIES, headers=auth_headers, json=payload)
    assert response.status_code == 409


def test_create_invalid_bucket_is_422(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        CATEGORIES, headers=auth_headers, json={"name": "X", "bucket": "invalido"}
    )
    assert response.status_code == 422


def test_update_own_category(client: TestClient, auth_headers: dict[str, str]) -> None:
    created = client.post(
        CATEGORIES, headers=auth_headers, json={"name": "Mascotas", "bucket": "monthly"}
    ).json()
    response = client.patch(
        f"{CATEGORIES}/{created['id']}", headers=auth_headers, json={"name": "Perros"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Perros"


def test_cannot_modify_default_category(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    default_id = client.get(CATEGORIES, headers=auth_headers).json()[0]["id"]
    response = client.patch(
        f"{CATEGORIES}/{default_id}", headers=auth_headers, json={"name": "Cambiada"}
    )
    assert response.status_code == 403


def test_delete_own_category(client: TestClient, auth_headers: dict[str, str]) -> None:
    created = client.post(
        CATEGORIES, headers=auth_headers, json={"name": "Mascotas", "bucket": "monthly"}
    ).json()
    assert client.delete(f"{CATEGORIES}/{created['id']}", headers=auth_headers).status_code == 204
    # Ya no aparece en el listado.
    names = [c["name"] for c in client.get(CATEGORIES, headers=auth_headers).json()]
    assert "Mascotas" not in names


def test_cannot_delete_default_category(
    client: TestClient, auth_headers: dict[str, str], seed_categories: None
) -> None:
    default_id = client.get(CATEGORIES, headers=auth_headers).json()[0]["id"]
    assert client.delete(f"{CATEGORIES}/{default_id}", headers=auth_headers).status_code == 403
