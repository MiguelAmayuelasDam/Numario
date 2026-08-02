"""Cartera de inversión: activos, reparto y aportaciones.

Orquesta el modelo (assets, investment_allocations) con el cálculo puro de
`investment_plan.compute_plan`. Una aportación **es un movimiento** (traspaso a
la categoría "Inversiones", con `asset_id`), así que el cubo Inversión del
50-30-20 se alimenta solo, sin tocar la analítica.
"""

import uuid
from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import extract, select
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.category import Category
from app.models.investment_allocation import InvestmentAllocation
from app.models.investment_group import InvestmentGroup
from app.models.transaction import Transaction
from app.models.user import User
from app.services import transaction_service
from app.services.investment_plan import AssetWeight, GroupWeight, compute_plan

# La categoría semilla a la que se imputan las aportaciones. Es un traspaso
# (no computable), y su bucket es "investment", así que alimenta el cubo.
INVESTMENT_CATEGORY = "Inversiones"


class AssetNotFoundError(Exception):
    """El activo no existe o no es del usuario."""


class GroupNotFoundError(Exception):
    """El grupo no existe o no es del usuario."""


@dataclass
class MonthAssetStatus:
    asset: Asset
    planned: Decimal  # lo que le tocaría según el reparto
    contributed: Decimal  # lo aportado de verdad este mes
    done: bool  # ¿ya hay aportación este mes?


# ── Reparto (allocation entre clases) ───────────────────────────────────────

def get_allocation(db: Session, user: User) -> InvestmentAllocation:
    """El split variable/fija del usuario, o el de por defecto (100/0)."""
    alloc = db.get(InvestmentAllocation, user.id)
    if alloc is None:
        return InvestmentAllocation(user_id=user.id, variable_pct=100, fixed_pct=0)
    return alloc


def set_allocation(
    db: Session, user: User, variable_pct: int, fixed_pct: int
) -> InvestmentAllocation:
    alloc = db.get(InvestmentAllocation, user.id)
    if alloc is None:
        alloc = InvestmentAllocation(user_id=user.id)
        db.add(alloc)
    alloc.variable_pct = variable_pct
    alloc.fixed_pct = fixed_pct
    db.commit()
    db.refresh(alloc)
    return alloc


# ── Grupos ──────────────────────────────────────────────────────────────────

def list_groups(db: Session, user: User) -> list[InvestmentGroup]:
    stmt = (
        select(InvestmentGroup)
        .where(InvestmentGroup.user_id == user.id)
        .order_by(InvestmentGroup.sort_order, InvestmentGroup.created_at)
    )
    return list(db.scalars(stmt).all())


def create_group(
    db: Session, user: User, *, name: str, asset_class: str, weight: Decimal
) -> InvestmentGroup:
    last = db.scalar(
        select(InvestmentGroup.sort_order)
        .where(InvestmentGroup.user_id == user.id)
        .order_by(InvestmentGroup.sort_order.desc())
    )
    group = InvestmentGroup(
        user_id=user.id,
        name=name.strip(),
        asset_class=asset_class,
        weight=weight,
        sort_order=(last or 0) + 1,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def _get_group(db: Session, user: User, group_id: uuid.UUID) -> InvestmentGroup:
    group = db.get(InvestmentGroup, group_id)
    if group is None or group.user_id != user.id:
        raise GroupNotFoundError
    return group


def update_group(
    db: Session, user: User, group_id: uuid.UUID, **changes: object
) -> InvestmentGroup:
    group = _get_group(db, user, group_id)
    for field in ("name", "asset_class", "weight"):
        if field in changes and changes[field] is not None:
            setattr(group, field, changes[field])
    db.commit()
    db.refresh(group)
    return group


def delete_group(db: Session, user: User, group_id: uuid.UUID) -> None:
    group = _get_group(db, user, group_id)
    # Sus activos pasan a colgar directos de la clase. Se hace explícito y no por
    # el ON DELETE SET NULL de la FK: SQLite (los tests) no lo aplica por defecto,
    # así que dependemos del motor si no lo hacemos aquí.
    for asset in db.scalars(select(Asset).where(Asset.group_id == group_id)).all():
        asset.group_id = None
    db.delete(group)
    db.commit()


# ── Activos ─────────────────────────────────────────────────────────────────

def list_assets(db: Session, user: User, *, include_archived: bool = False) -> list[Asset]:
    stmt = select(Asset).where(Asset.user_id == user.id)
    if not include_archived:
        stmt = stmt.where(Asset.active.is_(True))
    stmt = stmt.order_by(Asset.sort_order, Asset.created_at)
    return list(db.scalars(stmt).all())


def create_asset(
    db: Session,
    user: User,
    *,
    name: str,
    asset_class: str,
    kind: str,
    weight: Decimal,
    group_id: uuid.UUID | None = None,
) -> Asset:
    # El grupo, si se indica, debe ser del usuario y de la misma clase.
    if group_id is not None:
        group = _get_group(db, user, group_id)
        asset_class = group.asset_class
    # El nuevo va al final (mayor sort_order + 1).
    last = db.scalar(
        select(Asset.sort_order).where(Asset.user_id == user.id).order_by(Asset.sort_order.desc())
    )
    asset = Asset(
        user_id=user.id,
        name=name.strip(),
        asset_class=asset_class,
        kind=kind,
        weight=weight,
        group_id=group_id,
        sort_order=(last or 0) + 1,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def _get_asset(db: Session, user: User, asset_id: uuid.UUID) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None or asset.user_id != user.id:
        raise AssetNotFoundError
    return asset


def update_asset(db: Session, user: User, asset_id: uuid.UUID, **changes: object) -> Asset:
    asset = _get_asset(db, user, asset_id)
    # `group_id` puede venir como None a propósito (desasignar), así que se trata
    # aparte de los demás campos (donde None = "no cambiar").
    if "group_id" in changes:
        gid = changes.pop("group_id")
        asset.group_id = None if gid is None else uuid.UUID(str(gid))
        if asset.group_id is not None:
            asset.asset_class = _get_group(db, user, asset.group_id).asset_class
    for field in ("name", "asset_class", "kind", "weight", "active"):
        if field in changes and changes[field] is not None:
            setattr(asset, field, changes[field])
    db.commit()
    db.refresh(asset)
    return asset


def delete_asset(db: Session, user: User, asset_id: uuid.UUID) -> None:
    asset = _get_asset(db, user, asset_id)
    db.delete(asset)  # los movimientos conservan su histórico (asset_id → NULL)
    db.commit()


# ── Plan del mes y aportaciones ─────────────────────────────────────────────

def _plan_for(db: Session, user: User, total: Decimal) -> dict[str, Decimal]:
    alloc = get_allocation(db, user)
    groups = [GroupWeight(str(g.id), g.asset_class, g.weight) for g in list_groups(db, user)]
    assets = [
        AssetWeight(str(a.id), a.asset_class, str(a.group_id) if a.group_id else None, a.weight)
        for a in list_assets(db, user)
    ]
    return compute_plan(total, alloc.variable_pct, alloc.fixed_pct, groups, assets)


def _contributed_by_asset(
    db: Session, user: User, year: int, month: int
) -> dict[uuid.UUID, Decimal]:
    """Suma de lo aportado a cada activo en el mes (movimientos con asset_id)."""
    rows = db.execute(
        select(Transaction.asset_id, Transaction.amount).where(
            Transaction.user_id == user.id,
            Transaction.asset_id.is_not(None),
            extract("year", Transaction.occurred_on) == year,
            extract("month", Transaction.occurred_on) == month,
        )
    ).all()
    totals: dict[uuid.UUID, Decimal] = {}
    for asset_id, amount in rows:
        totals[asset_id] = totals.get(asset_id, Decimal("0")) + amount
    return totals


def month_status(
    db: Session, user: User, year: int, month: int, total: Decimal
) -> list[MonthAssetStatus]:
    """Estado del mes: por cada activo, lo previsto, lo aportado y si está hecho."""
    plan = _plan_for(db, user, total)
    contributed = _contributed_by_asset(db, user, year, month)
    result = []
    for asset in list_assets(db, user):
        done_amount = contributed.get(asset.id, Decimal("0.00"))
        result.append(
            MonthAssetStatus(
                asset=asset,
                planned=plan.get(str(asset.id), Decimal("0.00")),
                contributed=done_amount,
                done=asset.id in contributed,
            )
        )
    return result


def _investment_category_id(db: Session, user: User) -> uuid.UUID | None:
    """La categoría global 'Inversiones' (para imputar el traspaso al cubo)."""
    return db.scalar(
        select(Category.id).where(
            Category.name == INVESTMENT_CATEGORY, Category.user_id.is_(None)
        )
    )


def record_contribution(
    db: Session,
    user: User,
    asset_id: uuid.UUID,
    amount: Decimal,
    occurred_on: date,
) -> Transaction:
    """Registra una aportación a un activo como movimiento (traspaso, con activo).

    Es la acción de 'marcar como hecho': crea un traspaso a 'Inversiones' con el
    activo apuntado, que alimenta el cubo Inversión del 50-30-20.
    """
    asset = _get_asset(db, user, asset_id)
    return transaction_service.create_transaction(
        db,
        user,
        amount=amount,
        type_="transfer",
        concept=f"Aportación · {asset.name}",
        occurred_on=occurred_on,
        category_id=_investment_category_id(db, user),
        asset_id=asset.id,
    )


def undo_contributions(
    db: Session, user: User, asset_id: uuid.UUID, year: int, month: int
) -> int:
    """Desmarca: borra las aportaciones de un activo en un mes. Devuelve cuántas."""
    _get_asset(db, user, asset_id)
    rows = list(
        db.scalars(
            select(Transaction).where(
                Transaction.user_id == user.id,
                Transaction.asset_id == asset_id,
                extract("year", Transaction.occurred_on) == year,
                extract("month", Transaction.occurred_on) == month,
            )
        ).all()
    )
    for tx in rows:
        db.delete(tx)
    db.commit()
    return len(rows)


def default_contribution_date(year: int, month: int) -> date:
    """Fecha por defecto de una aportación: hoy si el mes es el actual, si no el
    último día del mes indicado (para registrar meses pasados con coherencia)."""
    today = date.today()
    if (year, month) == (today.year, today.month):
        return today
    return date(year, month, monthrange(year, month)[1])
