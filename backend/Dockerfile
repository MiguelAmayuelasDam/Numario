# Imagen base con uv preinstalado sobre Python 3.13.
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

# El entorno virtual vive fuera de /app para no quedar oculto por el bind mount
# de desarrollo (docker compose monta ./backend sobre /app).
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# 1) Capa de dependencias (se cachea si no cambian pyproject/uv.lock).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

# 2) Código de la aplicación.
COPY . .

EXPOSE 8000
# Se invoca con bash para no depender del bit de ejecución (editado en Windows).
ENTRYPOINT ["bash", "./docker-entrypoint.sh"]
