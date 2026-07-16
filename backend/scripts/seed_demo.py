"""Seed del usuario de demostración (Fase 7, bloque C).

Crea el usuario `mouredev` con un caso **realista** de dos años: 2025 completo y
2026 hasta el día de hoy. La historia que cuentan los datos es la de alguien que
en 2025 vivía **de alquiler** cobrando 2.800 €, y que en 2026 **compra piso**
(pasa a hipoteca) y consigue **una subida de sueldo en abril**.

Los importes están calculados a propósito para que se den **distintas
casuísticas** y la demo no salga entera en verde:
  · semáforo del 50-30-20 en **verde, ámbar y rojo** según el mes,
  · **ingreso variable**: nómina, subida de sueldo, pagas extra e IRPF,
  · un movimiento **sin categoría**,
  · **no computables**: aportes a inversión y traspasos entre cuentas,
  · **previsto vs gastado** en el mes en curso,
  · **dos años completos** para que la vista de Años tenga comparación real.

Uso (con el stack levantado):
    docker compose exec backend uv run python scripts/seed_demo.py
    docker compose exec backend uv run python scripts/seed_demo.py --reset
"""

import argparse
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import SessionLocal  # noqa: E402
from app.models.category import Category  # noqa: E402
from app.models.transaction import Transaction  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services import (  # noqa: E402
    auth_service,
    budget_service,
    emergency_fund_service,
    forecast_service,
)
from sqlalchemy import select  # noqa: E402

DEMO_EMAIL = "mouredev@gmail.com"
DEMO_NICK = "mouredev"
DEMO_PASSWORD = "Ahorr0!Constante"  # nosec B105 - credencial de demo, pública a propósito

Mes = tuple[int, int]  # (año, mes)
Mov = tuple[int, str | None, str, str, str]  # (día, categoría, concepto, importe, tipo)

MESES: list[Mes] = [(a, m) for a in (2025, 2026) for m in range(1, 13)]

# Pagas extra (junio y diciembre), aparte de la nómina.
PAGA_EXTRA: dict[Mes, str] = {
    (2025, 6): "1200.00", (2025, 12): "1200.00",
    (2026, 6): "1300.00", (2026, 12): "1300.00",
}


def _nomina(anio: int, mes: int) -> str:
    if anio == 2025:
        return "2800.00"
    return "3000.00" if mes <= 3 else "3300.00"  # subida de sueldo en abril de 2026


def _ingreso_planificado(anio: int, mes: int) -> Decimal:
    """Base del 50-30-20 del mes: nómina + paga extra si toca."""
    return Decimal(_nomina(anio, mes)) + Decimal(PAGA_EXTRA.get((anio, mes), "0"))


# Recurrentes de todos los meses (sin contar la vivienda, que cambia de año).
RECURRENTES: list[Mov] = [
    (2, "Seguro salud", "Seguro de salud", "48.00", "expense"),
    (2, "Deporte", "Gimnasio", "35.00", "expense"),
    (3, "Comunidad", "Comunidad de vecinos", "55.00", "expense"),
    (4, "Servicios y productos online", "Suscripciones", "25.90", "expense"),
    (5, "Supermercado", "Compra semanal", "78.40", "expense"),
    (7, "Restaurante", "Comida fuera", "32.00", "expense"),
    (8, "Electricidad", "Luz", "62.00", "expense"),
    (10, "Internet", "Fibra", "39.00", "expense"),
    (10, "Móvil", "Móvil", "15.00", "expense"),
    (12, "Supermercado", "Compra semanal", "64.20", "expense"),
    (13, "Otros ocio", "Ocio varios", "45.00", "expense"),
    (14, "Gasolina", "Gasolina", "55.00", "expense"),
    (19, "Supermercado", "Compra semanal", "81.10", "expense"),
    (21, "Restaurante", "Cena con amigos", "46.50", "expense"),
    (25, "Inversiones", "Aporte fondo indexado", "300.00", "transfer"),
    (26, "Supermercado", "Compra semanal", "59.90", "expense"),
]


def _base(anio: int) -> list[Mov]:
    """Recurrentes del año. En 2025 pagaba alquiler; en 2026 ya es hipoteca."""
    vivienda: Mov = (
        (1, "Alquiler y compra", "Alquiler del piso", "540.00", "expense")
        if anio == 2025
        else (1, "Hipoteca", "Hipoteca", "620.00", "expense")
    )
    return [vivienda, *RECURRENTES]


# Cubo Vida ≈ 1.097,60 € en 2025 (~78% de 1.400) y 1.177,60 € en 2026 (~79% de
# 1.500): verde de partida, para que sean los puntuales de abajo los que muevan
# el semáforo. Cubo Mes ≈ 184,40 € de partida.
EXTRAS: dict[Mes, list[Mov]] = {
    # ── 2025 ──────────────────────────────────────────────────────────────
    (2025, 2): [  # curso de formación → VIDA en ÁMBAR (1.357,60 / 1.400)
        (12, "Estudios", "Curso de formación", "260.00", "expense"),
    ],
    (2025, 4): [(18, "Ropa", "Ropa de primavera", "120.00", "expense")],
    (2025, 5): [(6, "Agua", "Agua (bimestral)", "48.00", "expense")],
    (2025, 6): [(20, "Hotel", "Puente de junio", "180.00", "expense")],
    (2025, 7): [  # verano → MES en ROJO (894,40 / 840)
        (11, "Hotel", "Vacaciones de verano", "520.00", "expense"),
        (18, "Espectáculos", "Conciertos", "190.00", "expense"),
    ],
    (2025, 8): [  # segunda escapada → MES en ÁMBAR (684,40 / 840)
        (8, "Hotel", "Escapada de agosto", "380.00", "expense"),
        (17, "Otras compras", "Compras del viaje", "120.00", "expense"),
    ],
    (2025, 9): [  # matrícula → VIDA en ROJO (1.447,60 / 1.400)
        (5, "Estudios", "Matrícula del máster", "350.00", "expense"),
    ],
    (2025, 11): [
        (28, "Ropa", "Black Friday", "180.00", "expense"),
        (29, "Electrónica", "Teclado y ratón", "240.00", "expense"),
    ],
    (2025, 12): [
        (18, "Regalos", "Regalos de Navidad", "260.00", "expense"),
        (25, "Inversiones", "Aporte extra (paga extra)", "600.00", "transfer"),
    ],
    # ── 2026 ──────────────────────────────────────────────────────────────
    (2026, 1): [(16, "Ropa", "Rebajas de enero", "95.00", "expense")],
    (2026, 2): [  # avería del coche → VIDA en ROJO (1.572,60 / 1.500)
        (17, "Mantenimiento vehículo", "Avería del coche", "395.00", "expense"),
    ],
    (2026, 3): [  # mes de caprichos → MES en ROJO (937,40 / 900)
        (11, "Electrónica", "Monitor 27 pulgadas", "329.00", "expense"),
        (18, "Ropa", "Zapatillas", "149.00", "expense"),
        (22, "Espectáculos", "Teatro", "95.00", "expense"),
        (28, "Hotel", "Escapada rural", "180.00", "expense"),
    ],
    (2026, 4): [(9, "Rendimientos", "Dividendos", "12.40", "income")],
    (2026, 5): [  # dentista → VIDA en ÁMBAR (1.405,60 / 1.650)
        (6, "Agua", "Agua (bimestral)", "48.00", "expense"),
        (14, "Óptica y dentista", "Dentista", "180.00", "expense"),
    ],
    (2026, 6): [  # viaje con la extra → MES en ÁMBAR (1.234,40 / 1.380)
        (12, "Devolución impuestos", "Devolución de la renta", "342.00", "income"),
        (15, "Hotel", "Vacaciones", "520.00", "expense"),
        (16, "Espectáculos", "Festival", "140.00", "expense"),
        (19, "Ropa", "Ropa de verano", "210.00", "expense"),
        (20, None, "Cargo sin identificar", "18.50", "expense"),  # sin categoría
        (22, "Otras compras", "Maleta", "180.00", "expense"),
        (24, "Traspasos y transferencias", "Traspaso a cuenta de ahorro", "200.00", "transfer"),
        (25, "Inversiones", "Aporte extra (paga extra)", "600.00", "transfer"),
    ],
    (2026, 7): [(9, "Médico", "Revisión médica", "70.00", "expense")],
}

# Aportaciones al colchón (día 28). Sube con las pagas extra y baja en los meses
# malos (matrícula, verano, avería del coche).
COLCHON_HABITUAL = {2025: "300.00", 2026: "400.00"}
COLCHON: dict[Mes, str] = {
    (2025, 6): "800.00", (2025, 7): "150.00", (2025, 9): "150.00", (2025, 12): "800.00",
    (2026, 1): "350.00", (2026, 2): "150.00", (2026, 3): "200.00", (2026, 6): "900.00",
}

# Previsto del mes en curso (Gastado vs Previsto).
PREVISTO = {"Supermercado": "300.00", "Restaurante": "120.00", "Gasolina": "60.00"}


def _categorias(db) -> dict[str, Category]:
    """Categorías globales indexadas por nombre."""
    return {c.name: c for c in db.scalars(select(Category).where(Category.user_id.is_(None))).all()}


def main() -> None:
    parser = argparse.ArgumentParser(description="Siembra el usuario de demostración.")
    parser.add_argument(
        "--reset", action="store_true", help="borra el usuario demo y lo vuelve a crear"
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        existente = db.scalar(select(User).where(User.nickname == DEMO_NICK))
        if existente is not None:
            if not args.reset:
                print(f"El usuario '{DEMO_NICK}' ya existe. Usa --reset para recrearlo.")
                return
            db.delete(existente)  # cascada: movimientos, presupuesto, colchón…
            db.commit()
            print(f"Usuario '{DEMO_NICK}' anterior borrado.")

        user = auth_service.register_user(
            db, email=DEMO_EMAIL, password=DEMO_PASSWORD, nickname=DEMO_NICK
        )

        # Presupuesto 50-30-20 e ingreso "habitual" (el de los meses sin ajuste).
        budget_service.upsert_budget(
            db, user, living_pct=50, monthly_pct=30, investment_pct=20,
            monthly_income=Decimal("3300"),
        )
        # Colchón: 6 meses × 1.600 €/mes = 9.600 € de objetivo.
        budget_service.set_emergency_months(db, user, 6)
        budget_service.set_emergency_monthly_need(db, user, Decimal("1600"))

        cats = _categorias(db)
        hoy = date.today()
        n = 0

        for anio, mes in MESES:
            if (anio, mes) > (hoy.year, hoy.month):
                break  # no inventamos meses futuros
            actual = (anio, mes) == (hoy.year, hoy.month)

            budget_service.set_monthly_income(db, user, anio, mes, _ingreso_planificado(anio, mes))

            movimientos: list[Mov] = [(1, "Nómina", "Nómina", _nomina(anio, mes), "income")]
            if (anio, mes) in PAGA_EXTRA:
                etiqueta = "junio" if mes == 6 else "diciembre"
                movimientos.append(
                    (1, "Otros ingresos", f"Paga extra de {etiqueta}",
                     PAGA_EXTRA[(anio, mes)], "income")
                )
            movimientos += [*_base(anio), *EXTRAS.get((anio, mes), [])]

            for dia, nombre_cat, concepto, importe, tipo in movimientos:
                if actual and dia > hoy.day:
                    continue  # en el mes en curso, nada en el futuro
                categoria = cats.get(nombre_cat) if nombre_cat else None
                if nombre_cat and categoria is None:
                    print(f"  aviso: no existe la categoría '{nombre_cat}', se omite")
                    continue
                db.add(
                    Transaction(
                        user_id=user.id,
                        category_id=categoria.id if categoria else None,
                        amount=Decimal(importe),
                        type=tipo,
                        concept=concepto,
                        occurred_on=date(anio, mes, dia),
                        source="manual",
                    )
                )
                n += 1
            db.commit()

            if not (actual and 28 > hoy.day):
                aporte = COLCHON.get((anio, mes), COLCHON_HABITUAL[anio])
                emergency_fund_service.add_contribution(
                    db, user, Decimal(aporte), date(anio, mes, 28)
                )

        for nombre, importe in PREVISTO.items():
            categoria = cats.get(nombre)
            if categoria is not None:
                forecast_service.set_forecast(db, user, categoria.id, Decimal(importe))

        print(f"Sembrado OK: '{DEMO_NICK}' con {n} movimientos (01/2025 → {hoy:%m/%Y}).")
        print(f"  Login → {DEMO_EMAIL}  ·  contraseña: {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
