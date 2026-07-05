# Backend — FinPer

API **FastAPI** (Python 3.13) con **SQLAlchemy 2.0**, **Alembic** y
**PostgreSQL**. Gestión de dependencias con **uv**.

## Estructura

```
app/
├── main.py            # crea la app FastAPI, CORS y monta routers
├── core/config.py     # configuración (pydantic-settings, variables de entorno)
├── db/base.py         # Base declarativa de SQLAlchemy
├── db/session.py      # engine, sesión y dependencia get_db()
├── models/user.py     # modelo User (esquema; la lógica de auth llega en Fase 2)
└── api/health.py      # GET /health (comprueba la conexión a la DB)
alembic/               # migraciones (0001_create_users = primera migración)
tests/                 # pytest (test de /health)
```

## Desarrollo local (sin Docker)

Requiere [uv](https://docs.astral.sh/uv/) y un PostgreSQL accesible.

```bash
uv sync                       # crea el venv e instala dependencias
cp ../.env.example ../.env    # ajusta DATABASE_URL a tu Postgres local
uv run alembic upgrade head   # aplica las migraciones
uv run uvicorn app.main:app --reload
```

API en http://localhost:8000 · documentación en http://localhost:8000/docs

## Calidad

```bash
uv run ruff check .   # lint
uv run mypy app       # tipos
uv run pytest         # tests
```

## Con Docker

Desde la raíz del repo: `docker compose up --build` (levanta backend + DB +
frontend). El contenedor aplica las migraciones automáticamente al arrancar.
