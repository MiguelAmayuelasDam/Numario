"""Categorías semilla por defecto (globales).

Fuente única de verdad para el sembrado: la usan tanto la migración de Alembic
(`0004_create_categories`) como los tests. Cada categoría tiene un **emoji** y
pertenece a un **bucket** de la regla 50-30-20 (más `transfer` para los
movimientos **no computables**, que no cuentan en el reparto):

- `living`     → Vida (50% — necesidades)
- `monthly`    → Mes (30% — estilo de vida)
- `investment` → Inversión (20% — ahorro/inversión)
- `income`     → Ingresos
- `transfer`   → No computable (traspasos/transferencias entre cuentas)
"""

# Buckets válidos (incluye `transfer` para lo no computable).
BUCKETS = ("living", "monthly", "investment", "income", "transfer")

# (nombre, bucket, emoji). Categorías globales sembradas una sola vez.
DEFAULT_CATEGORIES: list[tuple[str, str, str]] = [
    ("Agua", "living", "💧"),
    ("Alarmas y seguridad", "living", "👮"),
    ("Alquiler vehículos", "monthly", "🚗"),
    ("Alquiler y compra", "living", "🏠"),
    ("Asesores y abogados", "living", "📊"),
    ("Asociaciones", "monthly", "💼"),
    ("Ayuntamiento", "living", "🏛️"),
    ("Belleza", "monthly", "💅"),
    ("Cargos bancarios", "living", "🏦"),
    ("Compra vehículo", "living", "🚗"),
    ("Comunidad", "living", "🏬"),
    ("Deporte", "monthly", "🏃"),
    ("Devolución impuestos", "income", "🕺"),
    ("Efectivo", "transfer", "💵"),
    ("Electricidad", "living", "💡"),
    ("Electrónica", "monthly", "💻"),
    ("Espectáculos", "monthly", "🍿"),
    ("Estudios", "living", "📚"),
    ("Farmacia", "living", "💊"),
    ("Gas", "living", "🔅"),
    ("Gasolina", "living", "⛽"),
    ("Hipoteca", "living", "🏠"),
    ("Hogar", "living", "🛋️"),
    ("Hotel", "monthly", "🏨"),
    ("Impuestos", "living", "🔖"),
    ("Ingreso efectivo", "transfer", "💵"),
    ("Internet", "living", "📡"),
    ("Inversiones", "investment", "🤝"),
    ("Librería", "monthly", "📖"),
    ("Loterías", "monthly", "🎰"),
    ("Mantenimiento hogar", "living", "🛠️"),
    ("Mantenimiento vehículo", "living", "⚙️"),
    ("Material deportivo", "monthly", "👟"),
    ("Médico", "living", "🏥"),
    ("Móvil", "living", "📱"),
    ("Multas y licencias", "living", "🚨"),
    ("Niños y mascotas", "living", "👶"),
    ("Nómina", "income", "💰"),
    ("Óptica y dentista", "living", "👓"),
    ("Otras compras", "monthly", "🛍️"),
    ("Otros cargos y abonos", "transfer", "💱"),
    ("Otros gastos", "monthly", "💳"),
    ("Otros ingresos", "income", "💲"),
    ("Otros ocio", "monthly", "🗿"),
    ("Otros organismos", "living", "🏛️"),
    ("Otros salud, saber y deporte", "living", "🌡️"),
    ("Otros seguros", "living", "⚖️"),
    ("Otros servicios", "monthly", "📫"),
    ("Otros vivienda", "living", "🏡"),
    ("Parking y peaje", "living", "🅿️"),
    ("Pensión", "income", "🚸"),
    ("Pensión familiar", "living", "📈"),
    ("Préstamos", "investment", "💰"),
    ("Regalos", "monthly", "🎁"),
    ("Regalos recibidos", "income", "🎁"),
    ("Rendimientos", "income", "💹"),
    ("Rentas alquiler", "income", "🏠"),
    ("Restaurante", "monthly", "🍕"),
    ("Ropa", "monthly", "👕"),
    ("Seguridad Social", "living", "📊"),
    ("Seguro auto", "living", "🚗"),
    ("Seguro hogar", "living", "🏡"),
    ("Seguro mascotas", "living", "🐶"),
    ("Seguro moto", "living", "🛵"),
    ("Seguro salud", "living", "🏥"),
    ("Seguro viaje", "monthly", "✈️"),
    ("Seguro vida", "living", "💙"),
    ("Servicio doméstico", "living", "✨"),
    ("Servicios y productos online", "monthly", "👾"),
    ("Solidaridad", "monthly", "🤲"),
    ("Subvenciones y ayudas", "income", "👉"),
    ("Supermercado", "living", "🛒"),
    ("Tarjeta a débito", "transfer", "💳"),
    ("Tarjeta crédito", "transfer", "💳"),
    ("Televisión", "monthly", "📺"),
    ("Transferencia (Gasto)", "transfer", "💸"),
    ("Transferencia (Ingreso)", "transfer", "💵"),
    ("Transportes", "living", "🚀"),
    ("Traspasos y transferencias", "transfer", "🔄"),
]
