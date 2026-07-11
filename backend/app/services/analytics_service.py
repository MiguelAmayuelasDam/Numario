"""Agregación para la pantalla de Análisis.

Regla clave: los movimientos **No computables** (`type = transfer`) **no cuentan**
en ingresos, gastos, neto ni en los cubos 50-30-20.
"""

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
from app.services import budget_service

_CENTS = Decimal("0.01")
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
    budget = budget_service.get_or_default(db, user)
    pcts = {"living": budget.living_pct, "monthly": budget.monthly_pct,
            "investment": budget.investment_pct}
    spent_rows = db.execute(
        select(Category.bucket, func.coalesce(func.sum(Transaction.amount), 0))
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user.id,
            Transaction.type == "expense",
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
    cat_map = {c.id: c for c in db.scalars(select(Category)).all()}
    categories: list[CategoryStat] = []
    for category_id, spent in cat_rows:
        c = cat_map.get(category_id)
        categories.append(
            CategoryStat(
                category_id=category_id,
                name=c.name if c else "Sin categoría",
                emoji=c.emoji if c else None,
                bucket=c.bucket if c else None,
                spent=Decimal(spent or 0),
            )
        )
    categories.sort(key=lambda x: x.spent, reverse=True)

    return AnalyticsOverview(
        period_label=label, date_from=d_from, date_to=d_to,
        summary=summary, buckets=buckets, categories=categories,
    )


def series(db: Session, user: User, granularity: str, count: int) -> list[SeriesPoint]:
    today = date.today()
    points: list[SeriesPoint] = []

    if granularity == "year":
        for y in range(today.year - count + 1, today.year + 1):
            d_from, d_to, _, _ = _period_range("year", y, 1)
            points.append(
                SeriesPoint(
                    label=str(y), year=y, month=None,
                    income=_sum(db, user, "income", d_from, d_to),
                    expense=_sum(db, user, "expense", d_from, d_to),
                )
            )
        return points

    # Últimos `count` meses hasta el mes actual.
    y, m = today.year, today.month
    seq: list[tuple[int, int]] = []
    for _ in range(count):
        seq.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    for yy, mm in reversed(seq):
        d_from, d_to, _, _ = _period_range("month", yy, mm)
        points.append(
            SeriesPoint(
                label=_MONTHS_SHORT[mm - 1], year=yy, month=mm,
                income=_sum(db, user, "income", d_from, d_to),
                expense=_sum(db, user, "expense", d_from, d_to),
            )
        )
    return points
