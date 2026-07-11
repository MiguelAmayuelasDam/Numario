"""Servicio de importación de CSV: previsualización y confirmación."""

from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.category import CategoryRead
from app.schemas.import_ import ConfirmItem, ImportSummary, PreviewResponse, PreviewRow
from app.services.category_service import resolve_category_for_user
from app.services.classification import classify, learn_rule
from app.services.csv_import import parse_bank_csv

# Firma de un movimiento para deduplicar (misma fecha, importe, tipo y concepto).
_Signature = tuple[date, Decimal, str, str]


def _signature(occurred_on: date, amount: Decimal, type_: str, concept: str) -> _Signature:
    return (occurred_on, amount, type_, concept.strip())


def preview(db: Session, user: User, raw: bytes) -> PreviewResponse:
    parsed = parse_bank_csv(raw)

    # Multiset de firmas ya existentes (para marcar reimportaciones).
    existing_counts: dict[_Signature, int] = defaultdict(int)
    for tx in db.scalars(select(Transaction).where(Transaction.user_id == user.id)).all():
        existing_counts[_signature(tx.occurred_on, tx.amount, tx.type, tx.concept)] += 1

    seen: dict[_Signature, int] = defaultdict(int)
    rows: list[PreviewRow] = []
    classified = needs_review = duplicates = 0

    for parsed_row in parsed.rows:
        result = classify(db, user, parsed_row.concept)
        category = db.get(Category, result.category_id) if result.category_id else None

        sig = _signature(
            parsed_row.occurred_on, parsed_row.amount, parsed_row.type, parsed_row.concept
        )
        is_duplicate = existing_counts.get(sig, 0) - seen[sig] > 0
        if is_duplicate:
            seen[sig] += 1
            duplicates += 1

        if result.category_id is not None:
            classified += 1
        else:
            needs_review += 1

        rows.append(
            PreviewRow(
                concept=parsed_row.concept,
                occurred_on=parsed_row.occurred_on,
                amount=parsed_row.amount,
                type=parsed_row.type,
                suggested_category_id=result.category_id,
                category=CategoryRead.model_validate(category) if category else None,
                source=result.source,
                duplicate=is_duplicate,
            )
        )

    summary = ImportSummary(
        total=len(parsed.rows),
        classified=classified,
        needs_review=needs_review,
        duplicates=duplicates,
        errors=len(parsed.errors),
    )
    error_details = [f"Línea {e.line}: {e.reason}" for e in parsed.errors]
    return PreviewResponse(rows=rows, summary=summary, error_details=error_details)


def confirm(db: Session, user: User, items: list[ConfirmItem]) -> int:
    """Persiste los movimientos importados y **aprende** de las categorías."""
    for item in items:
        # Valida la categoría (global o del usuario). Lanza si es ajena.
        resolve_category_for_user(db, user, item.category_id)
        db.add(
            Transaction(
                user_id=user.id,
                category_id=item.category_id,
                amount=item.amount,
                type=item.type,
                concept=item.concept.strip(),
                occurred_on=item.occurred_on,
                source="import_csv",
            )
        )
        learn_rule(db, user, item.concept, item.category_id)

    db.commit()
    return len(items)
