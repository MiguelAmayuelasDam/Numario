"""Reparto de la aportación mensual entre los activos de la cartera.

Lógica financiera pura (no toca BD ni HTTP): recibe el total a invertir y el árbol
de la cartera (grupos con su split → activos), y devuelve cuántos euros van a cada
activo.

    Total → Grupo (% del total, con su split var/fija) → Activo (% de su clase)

Cada **grupo** pesa un % del total (los grupos y los activos sueltos suman 100).
Dentro de un grupo, su dinero se parte según **su propio** split variable/fija, y
cada mitad se reparte entre los activos de esa clase. Un activo **suelto** (sin
grupo) pesa directamente sobre el total.

Los pesos son **literales**: el peso de cada hijo es su % **de su padre**, no una
proporción que se normaliza. Si dentro de un padre los pesos suman 100 se reparte
todo; si suman menos (cartera a medias), el resto queda **sin asignar** — no se
infla el único activo presente al 100%. Si por datos heredados suman **más** de
100, el reparto se topa al 100% (proporcional) para no repartir más que el total.

El reparto **cuadra al céntimo** con lo asignado: método del mayor resto para que
los céntimos no se pierdan ni se dupliquen.
"""

from dataclasses import dataclass
from decimal import ROUND_FLOOR, ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


@dataclass(frozen=True)
class GroupWeight:
    """Un grupo: su peso (% del total) y su split interno entre clases."""

    group_id: str
    weight: Decimal
    variable_pct: Decimal
    fixed_pct: Decimal


@dataclass(frozen=True)
class AssetWeight:
    """Un activo: su clase (etiqueta), su grupo (o None si es suelto) y su peso
    (% de su clase dentro del grupo, o % del total si es suelto)."""

    asset_id: str
    asset_class: str
    group_id: str | None
    weight: Decimal


def _largest_remainder(cents: int, shares: dict[str, Decimal]) -> dict[str, int]:
    """Reparte `cents` céntimos entre `shares` (fracciones que suman 1) sin fugas.

    Cada uno se lleva su parte baja en céntimos; los sobrantes van, de uno en uno,
    a los de mayor resto. La suma es **exactamente** `cents`.
    """
    floors: dict[str, int] = {}
    remainders: list[tuple[Decimal, str]] = []
    for key, share in shares.items():
        exact = Decimal(cents) * share
        floor = int(exact.to_integral_value(rounding=ROUND_FLOOR))
        floors[key] = floor
        remainders.append((exact - floor, key))

    leftover = cents - sum(floors.values())
    remainders.sort(key=lambda r: r[0], reverse=True)  # sort estable → determinista
    for i in range(leftover):
        floors[remainders[i][1]] += 1
    return floors


def _distribute(parent_cents: int, weights: dict[str, Decimal]) -> dict[str, int]:
    """Reparte `parent_cents` entre hijos según pesos **literales** (% del padre).

    Si los pesos suman 100 se reparte todo; si suman menos, solo esa fracción y el
    resto queda sin repartir; si suman más de 100, se topa al 100% (proporcional)
    para no repartir más que el padre. Cuadra al céntimo con lo asignado.
    """
    if not weights:
        return {}
    sum_w = sum(weights.values(), Decimal(0))
    if sum_w <= 0:
        return dict.fromkeys(weights, 0)
    # Lo que de verdad se asigna: la fracción de los pesos presentes, topada al 100%.
    capped = min(sum_w, Decimal(100))
    allocated = int(
        (Decimal(parent_cents) * capped / 100).to_integral_value(rounding=ROUND_HALF_UP)
    )
    fractions = {k: w / sum_w for k, w in weights.items()}
    return _largest_remainder(allocated, fractions)


def compute_plan(
    total: Decimal,
    groups: list[GroupWeight],
    assets: list[AssetWeight],
) -> dict[str, Decimal]:
    """Euros por activo para una aportación de `total`.

    Nivel 1: el total se parte entre los grupos y los activos sueltos, por su peso
    (% del total). Nivel 2: el dinero de cada grupo se parte por su split
    variable/fija. Nivel 3: dentro de cada clase del grupo, entre sus activos.
    Pesos literales en todos.
    """
    if total < 0:
        raise ValueError("El total a invertir no puede ser negativo")

    result: dict[str, Decimal] = {a.asset_id: Decimal("0.00") for a in assets}
    if not assets:
        return {}

    total_cents = int((total / CENT).to_integral_value())
    loose = [a for a in assets if a.group_id is None]

    # Nivel 1 · lo de más alto nivel: grupos + activos sueltos, por su peso del total.
    top: dict[str, Decimal] = {f"g:{g.group_id}": g.weight for g in groups}
    top.update({f"a:{a.asset_id}": a.weight for a in loose})
    top_cents = _distribute(total_cents, top)

    for a in loose:
        result[a.asset_id] = Decimal(top_cents.get(f"a:{a.asset_id}", 0)) * CENT

    for g in groups:
        gc = top_cents.get(f"g:{g.group_id}", 0)
        # Nivel 2 · el dinero del grupo se parte por su split var/fija (suman 100).
        class_cents = _distribute(gc, {"variable": g.variable_pct, "fija": g.fixed_pct})
        # Nivel 3 · dentro de cada clase del grupo, entre sus activos.
        for cls in ("variable", "fija"):
            cls_assets = [
                a for a in assets if a.group_id == g.group_id and a.asset_class == cls
            ]
            asset_cents = _distribute(
                class_cents.get(cls, 0), {a.asset_id: a.weight for a in cls_assets}
            )
            for a in cls_assets:
                result[a.asset_id] = Decimal(asset_cents.get(a.asset_id, 0)) * CENT

    return result
