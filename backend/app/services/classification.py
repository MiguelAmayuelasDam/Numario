"""Clasificación de movimientos por reglas + aprendizaje (sin IA de pago).

Dos capas: 1) reglas **aprendidas** del usuario (tabla `classification_rule`,
alimentada por sus correcciones); 2) reglas **semilla** (diccionario de comercios
españoles → categoría). Se deja una interfaz de IA opcional **apagada** por
defecto (`settings.ai_provider = "none"`), como punto de extensión futuro.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.classification_rule import ClassificationRule
from app.models.user import User
from app.services.text_utils import normalize

# (fragmento normalizado, nombre EXACTO de categoría global). Orden: primero las
# reglas más específicas. Solo se usan nombres que existen en las 79 semilla.
SEED_RULES: list[tuple[str, str]] = [
    # Traspasos / transferencias
    ("traspaso", "Traspasos y transferencias"),
    ("bizum", "Traspasos y transferencias"),
    # Supermercado
    ("mercadona", "Supermercado"),
    ("carrefour", "Supermercado"),
    ("alcampo", "Supermercado"),
    ("mialcampo", "Supermercado"),
    ("lidl", "Supermercado"),
    ("eroski", "Supermercado"),
    ("consum", "Supermercado"),
    ("aldi", "Supermercado"),
    ("supermercado", "Supermercado"),
    # Restauración
    ("restaura", "Restaurante"),
    ("braseria", "Restaurante"),
    ("cerveceria", "Restaurante"),
    ("taberna", "Restaurante"),
    ("meson", "Restaurante"),
    ("asador", "Restaurante"),
    ("pizzeria", "Restaurante"),
    ("burger", "Restaurante"),
    ("kebab", "Restaurante"),
    ("gourmet", "Restaurante"),
    ("heladeria", "Restaurante"),
    ("cafe", "Restaurante"),
    ("cafeteria", "Restaurante"),
    ("bar ", "Restaurante"),
    ("smash", "Restaurante"),
    ("horno", "Restaurante"),
    # Ropa
    ("pull", "Ropa"),
    ("bear", "Ropa"),
    ("zara", "Ropa"),
    ("bershka", "Ropa"),
    ("stradivarius", "Ropa"),
    ("lefties", "Ropa"),
    ("mango", "Ropa"),
    ("primark", "Ropa"),
    # Electrónica
    ("media markt", "Electrónica"),
    ("mediamarkt", "Electrónica"),
    ("pccomponentes", "Electrónica"),
    ("worten", "Electrónica"),
    # Compras varias
    ("amazon", "Otras compras"),
    ("aliexpress", "Otras compras"),
    ("tiger", "Otras compras"),
    ("bazar", "Otras compras"),
    ("ebay", "Otras compras"),
    # Servicios / productos online
    ("steam", "Servicios y productos online"),
    ("netflix", "Servicios y productos online"),
    ("spotify", "Servicios y productos online"),
    ("playstation", "Servicios y productos online"),
    ("xbox", "Servicios y productos online"),
    ("google", "Servicios y productos online"),
    ("microsoft", "Servicios y productos online"),
    ("paypal", "Servicios y productos online"),
    # Transporte
    ("uber", "Transportes"),
    ("cabify", "Transportes"),
    ("bolt", "Transportes"),
    ("metro", "Transportes"),
    ("renfe", "Transportes"),
    ("alsa", "Transportes"),
    ("taxi", "Transportes"),
    ("emt", "Transportes"),
    # Gasolina
    ("repsol", "Gasolina"),
    ("cepsa", "Gasolina"),
    ("galp", "Gasolina"),
    ("petronor", "Gasolina"),
    ("gasolinera", "Gasolina"),
    # Ocio / espectáculos
    ("cine", "Espectáculos"),
    ("odeon", "Espectáculos"),
    ("yelmo", "Espectáculos"),
    ("cinesa", "Espectáculos"),
    ("movies", "Espectáculos"),
    ("teatro", "Espectáculos"),
    # Belleza
    ("peluqu", "Belleza"),
    ("barberia", "Belleza"),
    ("estetica", "Belleza"),
    # Telefonía
    ("movistar", "Móvil"),
    ("vodafone", "Móvil"),
    ("orange", "Móvil"),
    ("yoigo", "Móvil"),
    # Farmacia / salud
    ("farmacia", "Farmacia"),
    # Ingresos
    ("desempleo", "Otros ingresos"),
    ("nomina", "Nómina"),
]

# Si aparece uno de estos, el concepto es genérico (transferencia) → no se aprende.
_BLOCK_LEARNING = {"bizum", "traspaso", "transferencia", "traspasos", "transferencias"}
# Tokens de ruido: se saltan al derivar el keyword, pero no bloquean el aprendizaje.
_NOISE_TOKENS = {
    "www", "com", "es", "online", "http", "https", "pago", "compra",
    "recibo", "tarjeta", "cta", "cuenta", "del", "los", "las",
}


@dataclass
class ClassificationResult:
    category_id: uuid.UUID | None
    source: str | None  # "learned" | "rule" | None


def _default_category_ids_by_name(db: Session) -> dict[str, uuid.UUID]:
    rows = db.scalars(select(Category).where(Category.user_id.is_(None))).all()
    return {c.name: c.id for c in rows}


def classify(db: Session, user: User, concept: str) -> ClassificationResult:
    norm = normalize(concept)

    # 1) Reglas aprendidas del usuario (tienen prioridad).
    learned = db.scalars(
        select(ClassificationRule).where(ClassificationRule.user_id == user.id)
    ).all()
    for rule in learned:
        if rule.category_id is not None and rule.keyword and rule.keyword in norm:
            return ClassificationResult(rule.category_id, "learned")

    # 2) Reglas semilla.
    cat_ids = _default_category_ids_by_name(db)
    for keyword, category_name in SEED_RULES:
        if keyword in norm:
            category_id = cat_ids.get(category_name)
            if category_id is not None:
                return ClassificationResult(category_id, "rule")

    return ClassificationResult(None, None)


def learn_keyword(concept: str) -> str | None:
    """Deriva un keyword generalizable del concepto (primer token significativo).

    Devuelve `None` si el concepto es genérico (p. ej. "BIZUM ENVIADO").
    """
    tokens = normalize(concept).split()
    if any(t in _BLOCK_LEARNING for t in tokens):
        return None
    for token in tokens:
        if len(token) >= 3 and not any(c.isdigit() for c in token) and token not in _NOISE_TOKENS:
            return token
    return None


def learn_rule(db: Session, user: User, concept: str, category_id: uuid.UUID | None) -> None:
    """Registra/actualiza una regla aprendida (upsert por keyword). No commitea."""
    if category_id is None:
        return
    keyword = learn_keyword(concept)
    if keyword is None:
        return
    existing = db.scalar(
        select(ClassificationRule).where(
            ClassificationRule.user_id == user.id, ClassificationRule.keyword == keyword
        )
    )
    if existing is not None:
        existing.category_id = category_id
    else:
        db.add(ClassificationRule(user_id=user.id, keyword=keyword, category_id=category_id))
        # La sesión tiene autoflush=False; forzamos el flush para que la siguiente
        # llamada (misma importación, mismo keyword) encuentre la regla y no duplique.
        db.flush()
