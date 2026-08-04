"""Cartera de inversión: activos, reparto y aportaciones.

Orquesta el modelo (grupos, activos) con el cálculo puro de
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


class WeightExceededError(Exception):
    """Los pesos de un padre (nivel superior o clase de un grupo) superarían el 100%."""

    def __init__(self, room: Decimal) -> None:
        self.room = room
        super().__init__(f"Los pesos superan el 100%; quedan {room}% libres")


def _top_level_used(
    db: "Session",
    user: "User",
    *,
    exclude_group: uuid.UUID | None = None,
    exclude_asset: uuid.UUID | None = None,
) -> Decimal:
    """Peso del total ya ocupado por lo de nivel superior: grupos + activos sueltos."""
    total = Decimal("0")
    for g in list_groups(db, user):
        if g.id != exclude_group:
            total += g.weight
    for a in list_assets(db, user):  # solo activos: los archivados no ocupan reparto
        if a.group_id is None and a.id != exclude_asset:
            total += a.weight
    return total


def _group_room(db: "Session", user: "User", exclude_id: uuid.UUID | None = None) -> Decimal:
    """Peso del total libre para un grupo (100 - grupos y sueltos existentes)."""
    return Decimal(100) - _top_level_used(db, user, exclude_group=exclude_id)


def _asset_room(
    db: "Session",
    user: "User",
    *,
    group_id: uuid.UUID | None,
    asset_class: str,
    exclude_id: uuid.UUID | None = None,
) -> Decimal:
    """Peso libre para un activo: dentro de su clase en el grupo, o del total si es suelto."""
    if group_id is None:
        # Suelto: comparte el 100% del total con los grupos y los demás sueltos.
        return Decimal(100) - _top_level_used(db, user, exclude_asset=exclude_id)
    # En un grupo: comparte el 100% de su clase con los activos de esa misma clase.
    siblings = Decimal("0")
    for a in list_assets(db, user):
        if a.group_id == group_id and a.asset_class == asset_class and a.id != exclude_id:
            siblings += a.weight
    return Decimal(100) - siblings


@dataclass
class MonthAssetStatus:
    asset: Asset
    planned: Decimal  # lo que le tocaría según el reparto
    contributed: Decimal  # lo aportado de verdad este mes
    done: bool  # ¿ya hay aportación este mes?
    total_contributed: Decimal  # lo aportado a este activo en toda su historia


# ── Grupos ──────────────────────────────────────────────────────────────────

def list_groups(db: Session, user: User) -> list[InvestmentGroup]:
    stmt = (
        select(InvestmentGroup)
        .where(InvestmentGroup.user_id == user.id)
        .order_by(InvestmentGroup.sort_order, InvestmentGroup.created_at)
    )
    return list(db.scalars(stmt).all())


def create_group(
    db: Session,
    user: User,
    *,
    name: str,
    weight: Decimal,
    variable_pct: Decimal,
    fixed_pct: Decimal,
) -> InvestmentGroup:
    room = _group_room(db, user)
    if weight > room:
        raise WeightExceededError(room)
    last = db.scalar(
        select(InvestmentGroup.sort_order)
        .where(InvestmentGroup.user_id == user.id)
        .order_by(InvestmentGroup.sort_order.desc())
    )
    group = InvestmentGroup(
        user_id=user.id,
        name=name.strip(),
        weight=weight,
        variable_pct=variable_pct,
        fixed_pct=fixed_pct,
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
    new_weight = changes.get("weight")
    new_weight = group.weight if new_weight is None else Decimal(str(new_weight))
    room = _group_room(db, user, exclude_id=group.id)
    if new_weight > room:
        raise WeightExceededError(room)
    for field in ("name", "weight", "variable_pct", "fixed_pct"):
        if field in changes and changes[field] is not None:
            setattr(group, field, changes[field])
    db.commit()
    db.refresh(group)
    return group


def delete_group(db: Session, user: User, group_id: uuid.UUID) -> None:
    group = _get_group(db, user, group_id)
    # Sus activos pasan a sueltos. Se hace explícito y no por el ON DELETE SET NULL
    # de la FK: SQLite (los tests) no lo aplica por defecto, así que dependeríamos
    # del motor si no lo hiciéramos aquí.
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
    # El grupo, si se indica, debe ser del usuario. La clase es del activo (etiqueta):
    # dice de qué lado del split del grupo tira; no la manda el grupo.
    if group_id is not None:
        _get_group(db, user, group_id)
    room = _asset_room(db, user, group_id=group_id, asset_class=asset_class)
    if weight > room:
        raise WeightExceededError(room)
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
    # aparte de los demás campos (donde None = "no cambiar"). La clase no la manda
    # el grupo: es etiqueta del activo y se cambia por su propio campo.
    if "group_id" in changes:
        gid = changes.pop("group_id")
        asset.group_id = None if gid is None else uuid.UUID(str(gid))
        if asset.group_id is not None:
            _get_group(db, user, asset.group_id)  # valida que es del usuario

    # Comprobar el 100% del padre **destino** (con el grupo/clase ya actualizados),
    # excluyendo el propio activo de la suma de hermanos.
    new_weight = changes.get("weight")
    new_weight = asset.weight if new_weight is None else Decimal(str(new_weight))
    new_class = changes.get("asset_class") or asset.asset_class
    room = _asset_room(
        db, user, group_id=asset.group_id, asset_class=str(new_class), exclude_id=asset.id
    )
    if new_weight > room:
        raise WeightExceededError(room)

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
    groups = [
        GroupWeight(str(g.id), g.weight, g.variable_pct, g.fixed_pct)
        for g in list_groups(db, user)
    ]
    assets = [
        AssetWeight(str(a.id), a.asset_class, str(a.group_id) if a.group_id else None, a.weight)
        for a in list_assets(db, user)
    ]
    return compute_plan(total, groups, assets)


def _sum_by_asset(
    db: Session, user: User, year: int | None = None, month: int | None = None
) -> dict[uuid.UUID, Decimal]:
    """Suma de lo aportado a cada activo (movimientos con asset_id). Sin año/mes,
    es el acumulado de toda la historia; con ellos, solo el de ese mes."""
    stmt = select(Transaction.asset_id, Transaction.amount).where(
        Transaction.user_id == user.id,
        Transaction.asset_id.is_not(None),
    )
    if year is not None and month is not None:
        stmt = stmt.where(
            extract("year", Transaction.occurred_on) == year,
            extract("month", Transaction.occurred_on) == month,
        )
    totals: dict[uuid.UUID, Decimal] = {}
    for asset_id, amount in db.execute(stmt).all():
        totals[asset_id] = totals.get(asset_id, Decimal("0")) + amount
    return totals


def list_contributions(
    db: Session, user: User, asset_id: uuid.UUID | None = None
) -> list[Transaction]:
    """Histórico de aportaciones (movimientos con activo), de reciente a antiguo."""
    stmt = select(Transaction).where(
        Transaction.user_id == user.id, Transaction.asset_id.is_not(None)
    )
    if asset_id is not None:
        stmt = stmt.where(Transaction.asset_id == asset_id)
    stmt = stmt.order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc())
    return list(db.scalars(stmt).all())


def month_status(
    db: Session, user: User, year: int, month: int, total: Decimal
) -> list[MonthAssetStatus]:
    """Estado del mes: por cada activo, lo previsto, lo aportado este mes, si está
    hecho, y el total aportado a ese activo en toda su historia."""
    plan = _plan_for(db, user, total)
    contributed = _sum_by_asset(db, user, year, month)
    all_time = _sum_by_asset(db, user)
    result = []
    for asset in list_assets(db, user):
        done_amount = contributed.get(asset.id, Decimal("0.00"))
        result.append(
            MonthAssetStatus(
                asset=asset,
                planned=plan.get(str(asset.id), Decimal("0.00")),
                contributed=done_amount,
                done=asset.id in contributed,
                total_contributed=all_time.get(asset.id, Decimal("0.00")),
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
    extra: bool = False,
) -> Transaction:
    """Registra una aportación a un activo como movimiento (traspaso, con activo).

    Crea un traspaso a 'Inversiones' con el activo apuntado, que alimenta el cubo
    Inversión del 50-30-20. `extra` marca las aportaciones manuales (al margen del
    reparto) en el concepto, para distinguirlas en el historial.
    """
    asset = _get_asset(db, user, asset_id)
    prefix = "Aportación extra" if extra else "Aportación"
    return transaction_service.create_transaction(
        db,
        user,
        amount=amount,
        type_="transfer",
        concept=f"{prefix} · {asset.name}",
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
