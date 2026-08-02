"""Reparto de la aportación mensual entre los activos de la cartera.

Lógica financiera pura (no toca BD ni HTTP): recibe el total a invertir y el árbol
de la cartera (clases → grupos opcionales → activos), y devuelve cuántos euros van
a cada activo.

**Tres niveles**, como una hoja de cálculo de asignación:

    Total → Clase (variable/fija) → Grupo (opcional) → Activo

Los pesos son **literales**: el peso de cada hijo es su porcentaje **de su padre**,
no una proporción que se normaliza. Si dentro de un padre los pesos suman 100, se
reparte todo; si suman menos (cartera a medias), el resto queda **sin asignar** —
no se infla el único activo presente al 100%.

El reparto **cuadra al céntimo** con lo que sí está asignado: se usa el método del
mayor resto para que los céntimos no se pierdan ni se dupliquen.
"""

from dataclasses import dataclass
from decimal import ROUND_FLOOR, ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


@dataclass(frozen=True)
class GroupWeight:
    """Un grupo dentro de una clase, con su peso (% de la clase)."""

    group_id: str
    asset_class: str  # "variable" | "fija"
    weight: Decimal


@dataclass(frozen=True)
class AssetWeight:
    """Un activo: su clase, su grupo (o None si cuelga directo de la clase) y su
    peso (% de su padre: del grupo si lo tiene, si no de la clase)."""

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

    Si los pesos suman 100 se reparte todo; si suman menos, solo se asigna esa
    fracción y el resto se queda sin repartir. Cuadra al céntimo con lo asignado.
    """
    if not weights:
        return {}
    sum_w = sum(weights.values(), Decimal(0))
    if sum_w <= 0:
        return dict.fromkeys(weights, 0)
    # Lo que de verdad se asigna: la fracción de los pesos presentes.
    allocated = int((Decimal(parent_cents) * sum_w / 100).to_integral_value(rounding=ROUND_HALF_UP))
    fractions = {k: w / sum_w for k, w in weights.items()}
    return _largest_remainder(allocated, fractions)


def compute_plan(
    total: Decimal,
    variable_pct: int,
    fixed_pct: int,
    groups: list[GroupWeight],
    assets: list[AssetWeight],
) -> dict[str, Decimal]:
    """Euros por activo para una aportación de `total`, en tres niveles.

    Nivel 1: el total se parte entre clases (variable/fija). Nivel 2: dentro de
    cada clase, entre sus grupos y sus activos sueltos (los que no tienen grupo).
    Nivel 3: dentro de cada grupo, entre sus activos. Pesos literales en todos.
    """
    if total < 0:
        raise ValueError("El total a invertir no puede ser negativo")

    result: dict[str, Decimal] = {a.asset_id: Decimal("0.00") for a in assets}
    if not assets:
        return {} if not result else result

    total_cents = int((total / CENT).to_integral_value())

    # Nivel 1 · clases. variable_pct + fixed_pct = 100, así que cuadra con el total.
    class_cents = _distribute(
        total_cents, {"variable": Decimal(variable_pct), "fija": Decimal(fixed_pct)}
    )

    for cls in ("variable", "fija"):
        cc = class_cents.get(cls, 0)
        groups_in = [g for g in groups if g.asset_class == cls]
        loose = [a for a in assets if a.asset_class == cls and a.group_id is None]

        # Nivel 2 · hijos de la clase: grupos + activos sueltos, con su peso.
        children: dict[str, Decimal] = {f"g:{g.group_id}": g.weight for g in groups_in}
        children.update({f"a:{a.asset_id}": a.weight for a in loose})
        child_cents = _distribute(cc, children)

        for a in loose:
            result[a.asset_id] = Decimal(child_cents.get(f"a:{a.asset_id}", 0)) * CENT

        # Nivel 3 · dentro de cada grupo, entre sus activos.
        for g in groups_in:
            gc = child_cents.get(f"g:{g.group_id}", 0)
            grp_assets = [a for a in assets if a.group_id == g.group_id]
            asset_cents = _distribute(gc, {a.asset_id: a.weight for a in grp_assets})
            for a in grp_assets:
                result[a.asset_id] = Decimal(asset_cents.get(a.asset_id, 0)) * CENT

    return result
