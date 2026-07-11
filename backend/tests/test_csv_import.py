"""Tests del parser de CSV bancario (formato imagin)."""

from decimal import Decimal

from app.services.csv_import import parse_bank_csv

SAMPLE = (
    "IBAN;Saldo disponible;Periodo\n"
    "ES34...;11.766,93;01/06/2026 - 11/07/2026\n"
    "Concepto;Fecha;Importe;Saldo disponible\n"
    "BAR FETICHE;10/07/2026;-6,40EUR;11.766,93EUR\n"
    "PREST. DESEMPLEO;10/07/2026;758,61EUR;11.773,33EUR\n"
    "Traspaso del pago;13/06/2026;-650,00EUR;11.877,28EUR\n"
)


def test_ignores_metadata_and_parses_rows() -> None:
    result = parse_bank_csv(SAMPLE.encode("utf-8"))
    assert len(result.rows) == 3
    assert result.errors == []


def test_spanish_number_and_sign() -> None:
    result = parse_bank_csv(SAMPLE.encode("utf-8"))
    bar = result.rows[0]
    assert bar.concept == "BAR FETICHE"
    assert bar.amount == Decimal("6.40")  # positivo, el signo lo da el tipo
    assert bar.type == "expense"
    assert str(bar.occurred_on) == "2026-07-10"

    prestacion = result.rows[1]
    assert prestacion.amount == Decimal("758.61")
    assert prestacion.type == "income"


def test_traspaso_is_transfer() -> None:
    result = parse_bank_csv(SAMPLE.encode("utf-8"))
    traspaso = result.rows[2]
    assert traspaso.type == "transfer"  # no computable


def test_thousands_separator() -> None:
    csv = (
        "Concepto;Fecha;Importe;Saldo\n"
        "TRANSFERENCIA;02/06/2026;6.837,16EUR;12.470,63EUR\n"
    )
    result = parse_bank_csv(csv.encode("utf-8"))
    assert result.rows[0].amount == Decimal("6837.16")


def test_malformed_row_reported_not_crash() -> None:
    csv = (
        "Concepto;Fecha;Importe;Saldo\n"
        "BUENA;01/07/2026;-5,00EUR;10,00EUR\n"
        "MALA;fecha-invalida;-5,00EUR;10,00EUR\n"
    )
    result = parse_bank_csv(csv.encode("utf-8"))
    assert len(result.rows) == 1
    assert len(result.errors) == 1
    assert result.errors[0].line == 3


def test_no_header_returns_error() -> None:
    result = parse_bank_csv(b"cualquier;cosa;sin;cabecera\n1;2;3;4\n")
    assert result.rows == []
    assert len(result.errors) == 1


def test_cp1252_encoding() -> None:
    # "ANTOÑANZAS" con ñ en cp1252 no debe romper.
    csv = "Concepto;Fecha;Importe;Saldo\nANTOÑANZAS PELUQU;08/06/2026;-15,00EUR;10,00EUR\n"
    result = parse_bank_csv(csv.encode("cp1252"))
    assert len(result.rows) == 1
    assert "ANTO" in result.rows[0].concept
