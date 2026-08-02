"""Tests del reparto de la aportación mensual en tres niveles (TDD).

Clase → Grupo opcional → Activo, con pesos literales. Lo delicado: que cuadre al
céntimo con lo asignado, pase lo que pase con los decimales.
"""

from decimal import Decimal

import pytest
from app.services.investment_plan import AssetWeight, GroupWeight, compute_plan


def _sum(plan: dict) -> Decimal:
    return sum(plan.values(), Decimal("0"))


def a(id_: str, cls: str, group: str | None, weight: str) -> AssetWeight:
    return AssetWeight(id_, cls, group, Decimal(weight))


def g(id_: str, cls: str, weight: str) -> GroupWeight:
    return GroupWeight(id_, cls, Decimal(weight))


def test_caso_real_del_excel() -> None:
    """La cartera real del autor: 1000 € · 90/10 · variable en dos grupos."""
    plan = compute_plan(
        total=Decimal("1000.00"),
        variable_pct=90,
        fixed_pct=10,
        groups=[
            g("crecimiento", "variable", "70"),
            g("dividendos", "variable", "30"),
        ],
        assets=[
            a("SXR8", "variable", "crecimiento", "30"),
            a("SXRV", "variable", "crecimiento", "30"),
            a("IWDA", "variable", "crecimiento", "20"),
            a("EMIM", "variable", "crecimiento", "20"),
            a("VHYL", "variable", "dividendos", "40"),
            a("O", "variable", "dividendos", "10"),
            a("XRES", "variable", "dividendos", "20"),
            a("QUS5", "variable", "dividendos", "30"),
            a("VDTA", "fija", None, "50"),
            a("IEAC", "fija", None, "50"),
        ],
    )
    assert plan == {
        "SXR8": Decimal("189.00"),  # 1000 × 90% × 70% × 30%
        "SXRV": Decimal("189.00"),
        "IWDA": Decimal("126.00"),  # × 20%
        "EMIM": Decimal("126.00"),
        "VHYL": Decimal("108.00"),  # 1000 × 90% × 30% × 40%
        "O": Decimal("27.00"),  # × 10%
        "XRES": Decimal("54.00"),  # × 20%
        "QUS5": Decimal("81.00"),  # × 30%
        "VDTA": Decimal("50.00"),  # 1000 × 10% × 50%
        "IEAC": Decimal("50.00"),
    }
    assert _sum(plan) == Decimal("1000.00")


def test_activo_suelto_respeta_su_peso_literal() -> None:
    # Un único activo al 30% de su clase debe llevarse su 30%, NO el 100%.
    # (era el bug: se normalizaba y salía el total de la clase).
    plan = compute_plan(
        total=Decimal("1000.00"),
        variable_pct=90,
        fixed_pct=10,
        groups=[],
        assets=[a("SXR8", "variable", None, "30")],
    )
    # 1000 × 90% × 30% = 270. El 70% restante de variable queda sin asignar.
    assert plan["SXR8"] == Decimal("270.00")


def test_grupo_sin_activos_no_reparte() -> None:
    plan = compute_plan(
        total=Decimal("1000.00"),
        variable_pct=100,
        fixed_pct=0,
        groups=[g("vacio", "variable", "100")],
        assets=[],
    )
    assert plan == {}


def test_activos_sueltos_dos_niveles() -> None:
    # Renta fija con dos activos directos 50/50 (sin grupo).
    plan = compute_plan(
        total=Decimal("100.00"),
        variable_pct=0,
        fixed_pct=100,
        groups=[],
        assets=[a("VDTA", "fija", None, "50"), a("IEAC", "fija", None, "50")],
    )
    assert plan == {"VDTA": Decimal("50.00"), "IEAC": Decimal("50.00")}


def test_cuadra_con_decimales_feos() -> None:
    # Tres activos que suman 100 en peso (33,34 + 33,33 + 33,33), sobre un importe
    # que fuerza el redondeo: el céntimo sobrante no se pierde ni se duplica.
    plan = compute_plan(
        total=Decimal("10.00"),
        variable_pct=100,
        fixed_pct=0,
        groups=[g("gr", "variable", "100")],
        assets=[
            a("x", "variable", "gr", "33.34"),
            a("y", "variable", "gr", "33.33"),
            a("z", "variable", "gr", "33.33"),
        ],
    )
    assert _sum(plan) == Decimal("10.00")
    for amount in plan.values():
        assert abs(amount - Decimal("3.33")) <= Decimal("0.01")


def test_pesos_a_medias_dejan_resto_sin_asignar() -> None:
    # Si dentro de la clase solo hay un grupo al 70%, se asigna el 70%.
    plan = compute_plan(
        total=Decimal("1000.00"),
        variable_pct=100,
        fixed_pct=0,
        groups=[g("gr", "variable", "70")],
        assets=[a("x", "variable", "gr", "100")],
    )
    assert plan["x"] == Decimal("700.00")  # el 30% restante no se reparte


def test_total_cero() -> None:
    plan = compute_plan(
        total=Decimal("0.00"),
        variable_pct=100,
        fixed_pct=0,
        groups=[],
        assets=[a("x", "variable", None, "100")],
    )
    assert plan == {"x": Decimal("0.00")}


def test_sin_activos_vacio() -> None:
    assert compute_plan(Decimal("1000"), 100, 0, [], []) == {}


def test_total_negativo() -> None:
    with pytest.raises(ValueError, match="negativo"):
        compute_plan(Decimal("-1"), 100, 0, [], [])


@pytest.mark.parametrize("cents", [1, 7, 99, 100, 333, 1000, 12345, 99999, 777777])
def test_siempre_cuadra(cents: int) -> None:
    """Barrido de importes 'feos' contra un árbol con pesos no redondos."""
    total = Decimal(cents) * Decimal("0.01")
    plan = compute_plan(
        total=total,
        variable_pct=65,
        fixed_pct=35,
        groups=[g("g1", "variable", "60"), g("g2", "variable", "40")],
        assets=[
            a("a1", "variable", "g1", "70"),
            a("a2", "variable", "g1", "30"),
            a("a3", "variable", "g2", "100"),
            a("a4", "fija", None, "100"),
        ],
    )
    assert _sum(plan) == total
