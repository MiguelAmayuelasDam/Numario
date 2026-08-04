"""Tests del reparto de la aportación mensual (TDD).

    Total → Grupo (% del total, con su split var/fija) → Activo (% de su clase)

Los grupos y los activos sueltos comparten el 100% del total. Dentro de un grupo,
su dinero se parte por su split y luego entre los activos de cada clase. Lo
delicado: que cuadre al céntimo con lo asignado, pase lo que pase con los decimales.
"""

from decimal import Decimal

import pytest
from app.services.investment_plan import AssetWeight, GroupWeight, compute_plan


def _sum(plan: dict) -> Decimal:
    return sum(plan.values(), Decimal("0"))


def a(id_: str, cls: str, group: str | None, weight: str) -> AssetWeight:
    return AssetWeight(id_, cls, group, Decimal(weight))


def g(id_: str, weight: str, vpct: str = "100", fpct: str = "0") -> GroupWeight:
    return GroupWeight(id_, Decimal(weight), Decimal(vpct), Decimal(fpct))


def test_caso_real_del_excel() -> None:
    """La cartera real del autor: 1000 € en un grupo (bróker) al 100% con split
    90/10; 8 ETFs de variable y 2 de fija dentro del mismo grupo."""
    plan = compute_plan(
        total=Decimal("1000.00"),
        groups=[g("ib", "100", vpct="90", fpct="10")],
        assets=[
            a("SXR8", "variable", "ib", "21"),
            a("SXRV", "variable", "ib", "21"),
            a("IWDA", "variable", "ib", "14"),
            a("EMIM", "variable", "ib", "14"),
            a("VHYL", "variable", "ib", "12"),
            a("O", "variable", "ib", "3"),
            a("XRES", "variable", "ib", "6"),
            a("QUS5", "variable", "ib", "9"),
            a("VDTA", "fija", "ib", "50"),
            a("IEAC", "fija", "ib", "50"),
        ],
    )
    assert plan == {
        "SXR8": Decimal("189.00"),  # 1000 × 100% × 90% variable × 21%
        "SXRV": Decimal("189.00"),
        "IWDA": Decimal("126.00"),  # × 14%
        "EMIM": Decimal("126.00"),
        "VHYL": Decimal("108.00"),  # × 12%
        "O": Decimal("27.00"),  # × 3%
        "XRES": Decimal("54.00"),  # × 6%
        "QUS5": Decimal("81.00"),  # × 9%
        "VDTA": Decimal("50.00"),  # 1000 × 100% × 10% fija × 50%
        "IEAC": Decimal("50.00"),
    }
    assert _sum(plan) == Decimal("1000.00")


def test_activo_suelto_pesa_sobre_el_total() -> None:
    # Un activo suelto al 30% se lleva el 30% del total (no hay split que aplicar).
    plan = compute_plan(
        total=Decimal("1000.00"),
        groups=[],
        assets=[a("SXR8", "variable", None, "30")],
    )
    # 1000 × 30% = 300. El 70% restante del total queda sin asignar.
    assert plan["SXR8"] == Decimal("300.00")


def test_grupo_sin_activos_no_reparte() -> None:
    plan = compute_plan(
        total=Decimal("1000.00"),
        groups=[g("vacio", "100")],
        assets=[],
    )
    assert plan == {}


def test_activos_sueltos_reparten_el_total() -> None:
    # Dos activos sueltos 50/50 del total (la clase es solo etiqueta, no divide).
    plan = compute_plan(
        total=Decimal("100.00"),
        groups=[],
        assets=[a("VDTA", "fija", None, "50"), a("IEAC", "fija", None, "50")],
    )
    assert plan == {"VDTA": Decimal("50.00"), "IEAC": Decimal("50.00")}


def test_split_del_grupo_divide_entre_clases() -> None:
    # Grupo al 100% con split 90/10: una clase con un activo, la otra con otro.
    plan = compute_plan(
        total=Decimal("1000.00"),
        groups=[g("ib", "100", vpct="90", fpct="10")],
        assets=[
            a("SXR8", "variable", "ib", "100"),
            a("VDTA", "fija", "ib", "100"),
        ],
    )
    assert plan == {"SXR8": Decimal("900.00"), "VDTA": Decimal("100.00")}


def test_cuadra_con_decimales_feos() -> None:
    # Tres activos que suman 100 (33,34 + 33,33 + 33,33) sobre un importe que
    # fuerza el redondeo: el céntimo sobrante no se pierde ni se duplica.
    plan = compute_plan(
        total=Decimal("10.00"),
        groups=[g("gr", "100")],
        assets=[
            a("x", "variable", "gr", "33.34"),
            a("y", "variable", "gr", "33.33"),
            a("z", "variable", "gr", "33.33"),
        ],
    )
    assert _sum(plan) == Decimal("10.00")
    for amount in plan.values():
        assert abs(amount - Decimal("3.33")) <= Decimal("0.01")


def test_grupo_a_medias_deja_resto_sin_asignar() -> None:
    # Grupo al 70% del total con un activo al 100% de su clase: se asigna el 70%.
    plan = compute_plan(
        total=Decimal("1000.00"),
        groups=[g("gr", "70")],
        assets=[a("x", "variable", "gr", "100")],
    )
    assert plan["x"] == Decimal("700.00")  # el 30% restante del total no se reparte


def test_pesos_por_encima_de_100_se_topan() -> None:
    # Datos heredados incoherentes: grupo 100% + suelto 50% = 150% del total. No se
    # reparte más que el total; se topa al 100% (proporcional).
    plan = compute_plan(
        total=Decimal("1000.00"),
        groups=[g("gr", "100")],
        assets=[
            a("x", "variable", "gr", "100"),
            a("suelto", "variable", None, "50"),
        ],
    )
    assert _sum(plan) == Decimal("1000.00")


def test_total_cero() -> None:
    plan = compute_plan(
        total=Decimal("0.00"),
        groups=[],
        assets=[a("x", "variable", None, "100")],
    )
    assert plan == {"x": Decimal("0.00")}


def test_sin_activos_vacio() -> None:
    assert compute_plan(Decimal("1000"), [], []) == {}


def test_total_negativo() -> None:
    with pytest.raises(ValueError, match="negativo"):
        compute_plan(Decimal("-1"), [], [])


@pytest.mark.parametrize("cents", [1, 7, 99, 100, 333, 1000, 12345, 99999, 777777])
def test_siempre_cuadra(cents: int) -> None:
    """Barrido de importes 'feos' contra un árbol con pesos no redondos."""
    total = Decimal(cents) * Decimal("0.01")
    plan = compute_plan(
        total=total,
        groups=[g("g1", "60", vpct="65", fpct="35"), g("g2", "40")],
        assets=[
            a("a1", "variable", "g1", "70"),
            a("a2", "variable", "g1", "30"),
            a("a3", "fija", "g1", "100"),
            a("a4", "variable", "g2", "100"),
        ],
    )
    assert _sum(plan) == total
