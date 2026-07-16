"""Tipos y utilidades monetarias reutilizables de los schemas."""

from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import PlainSerializer

# Precisión monetaria: 2 decimales con redondeo estándar (regla §7.1).
CENTS = Decimal("0.01")

# Tope máximo para cualquier importe introducido por el usuario (importes de
# movimiento, ingreso mensual, previsto). Evita entradas absurdas/desbordes de UI.
MAX_AMOUNT = Decimal("9999999")


def quantize_money(value: Decimal) -> Decimal:
    """Redondea un importe a 2 decimales (ROUND_HALF_UP)."""
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def _to_money_str(value: Decimal) -> str:
    return f"{quantize_money(value):.2f}"


# Decimal que se serializa en JSON como string (regla §7.1: sin pérdida).
MoneyStr = Annotated[Decimal, PlainSerializer(_to_money_str, return_type=str)]
