"""Categorías semilla por defecto (globales).

Fuente única de verdad para el sembrado: la usan tanto la migración de Alembic
(`0004_create_categories`) como los tests. Cada categoría pertenece a un
**bucket** de la regla 50-30-20 (ver `docs/architecture/01-modelo-datos.md`).
"""

# Buckets válidos.
BUCKETS = ("living", "monthly", "investment", "income")

# (nombre, bucket). Categorías globales sembradas una sola vez.
DEFAULT_CATEGORIES: list[tuple[str, str]] = [
    # living (50% — gastos de vida)
    ("Vivienda", "living"),
    ("Suministros", "living"),
    ("Alimentación", "living"),
    ("Transporte", "living"),
    ("Salud", "living"),
    ("Seguros", "living"),
    # monthly (30% — gastos del mes)
    ("Restauración", "monthly"),
    ("Ocio", "monthly"),
    ("Ropa", "monthly"),
    ("Suscripciones", "monthly"),
    ("Caprichos", "monthly"),
    # investment (20% — inversión)
    ("Fondos", "investment"),
    ("Acciones", "investment"),
    ("Cripto", "investment"),
    ("Ahorro/Colchón", "investment"),
    # income (ingresos)
    ("Nómina", "income"),
    ("Extra", "income"),
    ("Reembolsos", "income"),
]
