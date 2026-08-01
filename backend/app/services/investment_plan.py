"""Reparto de la aportación mensual entre los activos de la cartera.

Lógica financiera pura (no toca BD ni HTTP): recibe el total a invertir, el split
entre clases y los pesos de los activos, y devuelve cuántos euros van a cada uno.

El requisito que lo hace delicado: el reparto **debe sumar exactamente el total**.
Repartir en porcentajes con decimales pierde céntimos (tres tercios de 1000 dan
999,99), así que se usa el **método del mayor resto**: se reparte por la parte
entera de céntimos y los céntimos sobrantes van, de uno en uno, a los activos con
mayor resto. Determinista y sin fugas.
"""

from collections import defaultdict
from dataclasses import dataclass
from decimal import ROUND_FLOOR, Decimal

CENT = Decimal("0.01")


@dataclass(frozen=True)
class AssetWeight:
    """Un activo para el cálculo: su id, su clase y su peso dentro de la clase."""

    asset_id: str
    asset_class: str  # "variable" | "fija"
    weight: Decimal


def _largest_remainder(cents_total: int, shares: dict[str, Decimal]) -> dict[str, Decimal]:
    """Reparte `cents_total` céntimos entre `shares` (fracciones que suman ≤ 1).

    Cada activo se lleva su parte baja en céntimos; los céntimos sobrantes van, de
    uno en uno, a los de mayor resto. Así la suma es **exactamente** `cents_total`.
    """
    floors: dict[str, int] = {}
    remainders: list[tuple[Decimal, str]] = []
    for key, share in shares.items():
        exact = Decimal(cents_total) * share
        floor = int(exact.to_integral_value(rounding=ROUND_FLOOR))
        floors[key] = floor
        remainders.append((exact - floor, key))

    leftover = cents_total - sum(floors.values())
    # Desempate estable: el orden de inserción se conserva en el sort de Python.
    remainders.sort(key=lambda r: r[0], reverse=True)
    for i in range(leftover):
        floors[remainders[i][1]] += 1

    return {k: Decimal(c) * CENT for k, c in floors.items()}


def compute_plan(
    total: Decimal,
    variable_pct: int,
    fixed_pct: int,
    assets: list[AssetWeight],
) -> dict[str, Decimal]:
    """Euros por activo para una aportación de `total`.

    Dos niveles: el total se parte entre clases (variable/fija) según sus
    porcentajes; dentro de cada clase se reparte entre sus activos por peso. Una
    clase sin activos no recibe nada (no se inventa un destino para ese dinero).

    Se calcula la **fracción del total** que le toca a cada activo
    (clase × peso-en-clase) y se reparten los céntimos del total **de una sola
    pasada**. Así cuadra al céntimo también *entre* clases, no solo dentro de cada
    una: redondear el importe de cada clase por separado se comía un céntimo.
    """
    if total < 0:
        raise ValueError("El total a invertir no puede ser negativo")
    if not assets:
        return {}

    by_class: dict[str, list[AssetWeight]] = defaultdict(list)
    for a in assets:
        by_class[a.asset_class].append(a)

    class_pct = {"variable": Decimal(variable_pct), "fija": Decimal(fixed_pct)}

    # Fracción del total que le corresponde a cada activo. Una clase sin activos
    # no reparte su parte (su dinero no tiene destino), así que la suma de las
    # fracciones puede ser < 1: el reparto se hace sobre esos céntimos, no sobre
    # el total entero.
    shares: dict[str, Decimal] = {}
    for cls, cls_assets in by_class.items():
        cls_fraction = class_pct.get(cls, Decimal(0)) / 100
        total_weight = sum((a.weight for a in cls_assets), Decimal("0"))
        if total_weight == 0:
            continue
        for a in cls_assets:
            shares[a.asset_id] = cls_fraction * (a.weight / total_weight)

    if not shares:
        return {a.asset_id: Decimal("0.00") for a in assets}

    cents_total = int((total / CENT).to_integral_value())
    frac_sum = sum(shares.values(), Decimal("0"))
    distributable = int((Decimal(cents_total) * frac_sum).to_integral_value())
    # Renormalizo las fracciones para que sumen 1 sobre los céntimos repartibles;
    # así el mayor-resto cuadra exactamente con `distributable`.
    norm = {k: v / frac_sum for k, v in shares.items()}
    return _largest_remainder(distributable, norm)
