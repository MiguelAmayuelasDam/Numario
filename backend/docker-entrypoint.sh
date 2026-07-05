#!/usr/bin/env bash
set -euo pipefail

# --no-sync: usa el entorno ya instalado en la imagen (no vuelve a resolver deps
# ni necesita red al arrancar el contenedor).

# Aplica las migraciones pendientes antes de arrancar la API.
echo "==> Aplicando migraciones de Alembic..."
uv run --no-sync alembic upgrade head

echo "==> Arrancando Uvicorn..."
exec uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
