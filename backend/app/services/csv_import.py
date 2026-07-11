"""Parser de extractos bancarios en CSV (formato imagin/CaixaBank).

Tolerante: ignora las líneas de metadatos, detecta la cabecera real
(`Concepto;Fecha;Importe;…`) y entiende el formato español de importe
(`-6,40EUR`, `11.766,93EUR`). El **signo** decide gasto/ingreso; los traspasos
entre cuentas se marcan como `transfer` (no computable).
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.services.text_utils import normalize

# Solo los traspasos inter-cuenta claros son "no computable"; los bizum se dejan
# por signo (suelen ser gastos/ingresos reales), su categoría la sugieren reglas.
_TRANSFER_KEYWORDS = ("traspaso",)
_ENCODINGS = ("utf-8-sig", "utf-8", "cp1252", "latin-1")


@dataclass
class ParsedRow:
    concept: str
    occurred_on: date
    amount: Decimal  # siempre positivo; el signo lo da `type`
    type: str  # income | expense | transfer


@dataclass
class RowError:
    line: int
    raw: str
    reason: str


@dataclass
class ParseResult:
    rows: list[ParsedRow] = field(default_factory=list)
    errors: list[RowError] = field(default_factory=list)


def _decode(raw: bytes) -> str:
    for enc in _ENCODINGS:
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _parse_amount(raw: str) -> Decimal:
    s = raw.strip().upper().replace("EUR", "").replace("€", "").replace(" ", "")
    s = s.replace(".", "").replace(",", ".")  # miles → nada, decimal , → .
    return Decimal(s)


def _parse_date(raw: str) -> date:
    return datetime.strptime(raw.strip(), "%d/%m/%Y").date()


def _detect_type(concept: str, value: Decimal) -> str:
    norm = normalize(concept)
    if any(k in norm for k in _TRANSFER_KEYWORDS):
        return "transfer"
    return "expense" if value < 0 else "income"


def parse_bank_csv(raw: bytes) -> ParseResult:
    text = _decode(raw)
    lines = text.splitlines()
    result = ParseResult()

    # Localiza la cabecera real (fila con Concepto y Fecha).
    header_idx: int | None = None
    ci = di = ai = None
    for i, line in enumerate(lines):
        lower = [c.strip().lower() for c in line.split(";")]
        if "concepto" in lower and "fecha" in lower:
            header_idx = i
            ci = lower.index("concepto")
            di = lower.index("fecha")
            ai = next((j for j, c in enumerate(lower) if "importe" in c), None)
            break

    if header_idx is None or ci is None or di is None or ai is None:
        result.errors.append(
            RowError(0, "", "No se encontró la cabecera (Concepto;Fecha;Importe)")
        )
        return result

    needed = max(ci, di, ai)
    for i in range(header_idx + 1, len(lines)):
        raw_line = lines[i]
        if not raw_line.strip():
            continue
        cells = [c.strip() for c in raw_line.split(";")]
        if len(cells) <= needed:
            result.errors.append(RowError(i + 1, raw_line, "Faltan columnas"))
            continue
        try:
            concept = cells[ci]
            if not concept:
                raise ValueError("concepto vacío")
            occurred_on = _parse_date(cells[di])
            value = _parse_amount(cells[ai])
            type_ = _detect_type(concept, value)
            result.rows.append(
                ParsedRow(
                    concept=concept,
                    occurred_on=occurred_on,
                    amount=abs(value),
                    type=type_,
                )
            )
        except (ValueError, InvalidOperation) as exc:
            result.errors.append(RowError(i + 1, raw_line, f"Fila inválida: {exc}"))

    return result
