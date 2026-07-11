"""Tests del presupuesto 50-30-20 configurable."""

from fastapi.testclient import TestClient

BUDGET = "/api/v1/budget"


def test_requires_auth(client: TestClient) -> None:
    assert client.get(BUDGET).status_code in {401, 403}


def test_get_default_budget(client: TestClient, auth_headers: dict[str, str]) -> None:
    body = client.get(BUDGET, headers=auth_headers).json()
    assert body["monthly_income"] == "0.00"
    assert (body["living_pct"], body["monthly_pct"], body["investment_pct"]) == (50, 30, 20)


def test_update_budget(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.put(
        BUDGET,
        headers=auth_headers,
        json={
            "monthly_income": "2000.00",
            "living_pct": 65,
            "monthly_pct": 25,
            "investment_pct": 10,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["monthly_income"] == "2000.00"
    assert body["living_pct"] == 65
    # Persistido.
    assert client.get(BUDGET, headers=auth_headers).json()["living_pct"] == 65


def test_percentages_must_sum_100(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.put(
        BUDGET,
        headers=auth_headers,
        json={
            "monthly_income": "2000.00",
            "living_pct": 50,
            "monthly_pct": 30,
            "investment_pct": 10,  # suma 90 ≠ 100
        },
    )
    assert response.status_code == 422
