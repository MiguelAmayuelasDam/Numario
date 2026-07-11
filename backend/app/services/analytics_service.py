"""Agregación para la pantalla de Análisis.

Regla clave: los movimientos **No computables** (`type = transfer`) **no cuentan**
en ingresos, gastos, neto ni en los cubos 50-30-20.
"""

import uuid
from calendar import monthrange
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsOverview,
    BucketStat,
    CategoryStat,
    SeriesPoint,
    Summary,
)
from app.services import budget_service, forecast_service

_CENTS = Decimal("0.01")
# Categorías comunes por cubo que se ofrecen para previsión (mes en curso) aunque
# aún no tengan gastos, para poder planificar a principio de mes.
_COMMON_FORECAST = [
    "Supermercado", "Hipoteca", "Alquiler y compra", "Electricidad", "Gasolina",
    "Farmacia", "Móvil", "Restaurante", "Otros ocio", "Ropa",
    "Servicios y productos online", "Belleza", "Inversiones", "Préstamos",
]
_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
           "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
_MONTHS_SHORT = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL",
                 "AGO", "SEP", "OCT", "NOV", "DIC"]
# Cubos del 50-30-20 (los ingresos y "transfer" no son cubos de gasto).
_BUCKETS = [("living", "Vida"), ("monthly", "Mes"), ("investment", "Inversión")]


def _period_range(granularity: str, year: int, month: int) -> tuple[date, date, int, str]:
    if granularity == "year":
        return date(year, 1, 1), date(year, 12, 31), 12, str(year)
    last = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last), 1, f"{_MONTHS[month - 1]} {year}"


def _sum(db: Session, user: User, type_: str, d_from: date, d_to: date) -> Decimal:
    stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == user.id,
        Transaction.type == type_,
        Transaction.occurred_on >= d_from,
        Transaction.occurred_on <= d_to,
    )
    return Decimal(db.scalar(stmt) or 0)


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(_CENTS, rounding=ROUND_HALF_UP)


def overview(
    db: Session, user: User, granularity: str, year: int, month: int
) -> AnalyticsOverview:
    d_from, d_to, months, label = _period_range(granularity, year, month)

    income = _sum(db, user, "income", d_from, d_to)
    expense = _sum(db, user, "expense", d_from, d_to)
    summary = Summary(income=income, expense=expense, net=income - expense)

    # Cubos 50-30-20: presupuesto desde la configuración, gasto real por bucket.
    # Cuentan gastos Y traspasos asignados al cubo (una inversión es parte de tu
    # 20% aunque se registre como traspaso). Los ingresos nunca son cubo de gasto.
    budget = budget_service.get_or_default(db, user)
    pcts = {"living": budget.living_pct, "monthly": budget.monthly_pct,
            "investment": budget.investment_pct}
    spent_rows = db.execute(
        select(Category.bucket, func.coalesce(func.sum(Transaction.amount), 0))
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user.id,
            Transaction.type.in_(["expense", "transfer"]),
            Transaction.occurred_on >= d_from,
            Transaction.occurred_on <= d_to,
        )
        .group_by(Category.bucket)
    ).all()
    spent_by_bucket = {b: Decimal(s or 0) for b, s in spent_rows}

    buckets: list[BucketStat] = []
    for bucket, blabel in _BUCKETS:
        spent = spent_by_bucket.get(bucket, Decimal(0))
        bucket_budget = _quantize(budget.monthly_income * pcts[bucket] / 100 * months)
        pct = int(spent / bucket_budget * 100) if bucket_budget > 0 else 0
        status = "over" if pct > 100 else "warning" if pct >= 80 else "ok"
        buckets.append(
            BucketStat(
                bucket=bucket, label=blabel, budget=bucket_budget, spent=spent,
                pct=pct, status=status,
            )
        )

    # ¿El periodo es el mes en curso? Solo entonces se permite prever.
    now = date.today()
    is_current = granularity == "month" and year == now.year and month == now.month

    # Desglose de gastos por categoría (ordenado desc).
    cat_rows = db.execute(
        select(Transaction.category_id, func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user.id,
            Transaction.type == "expense",
            Transaction.occurred_on >= d_from,
            Transaction.occurred_on <= d_to,
        )
        .group_by(Transaction.category_id)
    ).all()
    spent_by_cat = {cid: Decimal(s or 0) for cid, s in cat_rows}
    cat_map = {c.id: c for c in db.scalars(select(Category)).all()}
    forecasts = forecast_service.get_map(db, user) if is_current else {}

    # Ids a mostrar: las que tienen gasto; en el mes actual, además las que tienen
    # previsto y una lista de categorías comunes por cubo (para planificar).
    include_ids: set[uuid.UUID | None] = set(spent_by_cat.keys())
    if is_current:
        include_ids |= set(forecasts.keys())
        name_to_id = {c.name: c.id for c in cat_map.values() if c.user_id is None}
        for name in _COMMON_FORECAST:
            cid = name_to_id.get(name)
            if cid is not None:
                include_ids.add(cid)

    categories: list[CategoryStat] = []
    for category_id in include_ids:
        c = cat_map.get(category_id) if category_id is not None else None
        categories.append(
            CategoryStat(
                category_id=category_id,
                name=c.name if c else "Sin categoría",
                emoji=c.emoji if c else None,
                bucket=c.bucket if c else None,
                spent=spent_by_cat.get(category_id, Decimal(0)),
                forecast=(
                    forecasts.get(category_id)
                    if is_current and category_id is not None
                    else None
                ),
            )
        )
    # Primero las que tienen gasto (desc), luego las de solo previsión por nombre.
    categories.sort(key=lambda x: (-x.spent, x.name))

    return AnalyticsOverview(
        period_label=label, date_from=d_from, date_to=d_to, is_current=is_current,
        summary=summary, buckets=buckets, categories=categories,
    )


def series(db: Session, user: User, granularity: str, year: int, count: int) -> list[SeriesPoint]:
    """Serie para el navegador. `year` es el año-ancla de la ventana mostrada.

    - `month`: los 12 meses de `year`.
    - `year`: los `count` años que terminan en `year`.
    """
    points: list[SeriesPoint] = []

    if granularity == "year":
        for y in range(year - count + 1, year + 1):
            d_from, d_to, _, _ = _period_range("year", y, 1)
            points.append(
                SeriesPoint(
                    label=str(y), year=y, month=None,
                    income=_sum(db, user, "income", d_from, d_to),
                    expense=_sum(db, user, "expense", d_from, d_to),
                )
            )
        return points

    for mm in range(1, 13):
        d_from, d_to, _, _ = _period_range("month", year, mm)
        points.append(
            SeriesPoint(
                label=_MONTHS_SHORT[mm - 1], year=year, month=mm,
                income=_sum(db, user, "income", d_from, d_to),
                expense=_sum(db, user, "expense", d_from, d_to),
            )
        )
    return points
