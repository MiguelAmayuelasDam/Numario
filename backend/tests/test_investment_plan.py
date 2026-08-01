"""Tests del reparto de la aportación mensual entre activos (Fase B, TDD).

Es lógica financiera pura: no toca la base de datos ni HTTP. Lo delicado es que
el reparto **cuadre al céntimo** con el total, pase lo que pase con los decimales.
"""

from decimal import Decimal

import pytest
from app.services.investment_plan import AssetWeight, compute_plan


def _sum(plan: dict) -> Decimal:
    return sum(plan.values(), Decimal("0"))


def test_reparto_de_dos_niveles_limpio() -> None:
    # 1000 € · variable 70% / fija 30% · dentro de variable 60/40, fija 100.
    plan = compute_plan(
        total=Decimal("1000.00"),
        variable_pct=70,
        fixed_pct=30,
        assets=[
            AssetWeight("etf-world", "variable", Decimal("60")),
            AssetWeight("etf-sp", "variable", Decimal("40")),
            AssetWeight("fondo-rf", "fija", Decimal("100")),
        ],
    )
    assert plan == {
        "etf-world": Decimal("420.00"),  # 60% de 700
        "etf-sp": Decimal("280.00"),  # 40% de 700
        "fondo-rf": Decimal("300.00"),  # 100% de 300
    }
    assert _sum(plan) == Decimal("1000.00")


def test_cuadra_al_centimo_con_decimales_feos() -> None:
    # Tres activos al 33,33% de una sola clase: 333,33 × 3 = 999,99. El céntimo
    # que falta se asigna por mayor resto, sin perderlo.
    plan = compute_plan(
        total=Decimal("1000.00"),
        variable_pct=100,
        fixed_pct=0,
        assets=[
            AssetWeight("a", "variable", Decimal("1")),
            AssetWeight("b", "variable", Decimal("1")),
            AssetWeight("c", "variable", Decimal("1")),
        ],
    )
    assert _sum(plan) == Decimal("1000.00")
    # Ninguna parte se aleja más de un céntimo del reparto ideal (333,33).
    for amount in plan.values():
        assert abs(amount - Decimal("333.33")) <= Decimal("0.01")


def test_importe_con_decimales_tambien_cuadra() -> None:
    plan = compute_plan(
        total=Decimal("333.33"),
        variable_pct=50,
        fixed_pct=50,
        assets=[
            AssetWeight("a", "variable", Decimal("100")),
            AssetWeight("b", "fija", Decimal("100")),
        ],
    )
    assert _sum(plan) == Decimal("333.33")


def test_un_solo_activo_se_lleva_todo() -> None:
    plan = compute_plan(
        total=Decimal("500.00"),
        variable_pct=100,
        fixed_pct=0,
        assets=[AssetWeight("unico", "variable", Decimal("100"))],
    )
    assert plan == {"unico": Decimal("500.00")}


def test_clase_sin_activos_no_recibe_nada() -> None:
    # Fija tiene el 30% pero no hay ningún activo de renta fija: ese dinero no se
    # puede repartir, así que no se inventa un destino. Se reparte solo lo que
    # tiene activos, y el total repartido es el de la clase con activos.
    plan = compute_plan(
        total=Decimal("1000.00"),
        variable_pct=70,
        fixed_pct=30,
        assets=[AssetWeight("etf", "variable", Decimal("100"))],
    )
    assert plan == {"etf": Decimal("700.00")}
    assert _sum(plan) == Decimal("700.00")


def test_pesos_que_no_suman_cien_se_normalizan() -> None:
    # Dentro de una clase los pesos deberían sumar 100, pero si el usuario pone
    # 3 y 1 (proporción 3:1), se respeta la proporción igualmente.
    plan = compute_plan(
        total=Decimal("400.00"),
        variable_pct=100,
        fixed_pct=0,
        assets=[
            AssetWeight("grande", "variable", Decimal("3")),
            AssetWeight("pequeno", "variable", Decimal("1")),
        ],
    )
    assert plan == {"grande": Decimal("300.00"), "pequeno": Decimal("100.00")}


def test_total_cero_reparte_cero() -> None:
    plan = compute_plan(
        total=Decimal("0.00"),
        variable_pct=60,
        fixed_pct=40,
        assets=[
            AssetWeight("a", "variable", Decimal("100")),
            AssetWeight("b", "fija", Decimal("100")),
        ],
    )
    assert plan == {"a": Decimal("0.00"), "b": Decimal("0.00")}


def test_sin_activos_reparto_vacio() -> None:
    plan = compute_plan(total=Decimal("1000.00"), variable_pct=100, fixed_pct=0, assets=[])
    assert plan == {}


def test_total_negativo_no_permitido() -> None:
    with pytest.raises(ValueError, match="negativo"):
        compute_plan(total=Decimal("-1.00"), variable_pct=100, fixed_pct=0, assets=[])


@pytest.mark.parametrize(
    "total_cents", [1, 7, 99, 100, 333, 1000, 12345, 99999, 100001, 777777]
)
def test_siempre_cuadra_con_lo_repartible(total_cents: int) -> None:
    """Con activos en las dos clases, el reparto suma siempre el total exacto.

    Barrido de importes 'feos' contra un reparto con pesos no redondos, que es
    donde se cuela un céntimo si el redondeo está mal."""
    total = Decimal(total_cents) * Decimal("0.01")
    plan = compute_plan(
        total=total,
        variable_pct=65,
        fixed_pct=35,
        assets=[
            AssetWeight("a", "variable", Decimal("3")),
            AssetWeight("b", "variable", Decimal("2")),
            AssetWeight("c", "fija", Decimal("7")),
        ],
    )
    assert _sum(plan) == total
