# Comandos — guía de ejecución (runbook)

> Todos los comandos necesarios para levantar el proyecto, correr los tests y
> verificar cada fase. Incluye la forma **con Docker** (recomendada, no requiere
> instalar nada) y la forma **nativa**.
>
> Rutas relativas a la raíz del repo (`Numario/`). En Windows se usa PowerShell;
> los bloques marcados como `bash` valen para Git Bash / Linux / macOS.

## Índice
- [Requisitos](#requisitos)
- [Stack completo con Docker](#stack-completo-con-docker)
- [Base de datos y migraciones](#base-de-datos-y-migraciones)
- [Backend: tests, lint y tipos](#backend-tests-lint-y-tipos)
- [Frontend: tests, lint, tipos y build](#frontend-tests-lint-tipos-y-build)
- [E2E (Playwright)](#e2e-playwright)
- [Verificación manual de la API (curl)](#verificación-manual-de-la-api-curl)
- [Checklist de verificación por fase](#checklist-de-verificación-por-fase)

---

## Requisitos
- **Docker Desktop** (Compose v2). Es lo único imprescindible.
- Opcionales para el flujo nativo: **Node 22+** y **npm** (frontend), y **`uv`**
  (backend). Si no tienes `uv`, usa la variante "en contenedor" de más abajo.

Primera vez: copia la plantilla de variables de entorno.
```bash
cp .env.example .env
```

---

## Stack completo con Docker

Levantar los tres servicios (postgres + backend + frontend):
```powershell
docker compose up --build          # en primer plano (Ctrl+C para parar)
docker compose up -d --build       # en segundo plano
```

Accesos:
- Frontend (la app): http://localhost:5173
- API + Swagger: http://localhost:8000/docs
- Health check: http://localhost:8000/health → `{"status":"ok","db":"ok"}`

Operaciones habituales:
```powershell
docker compose ps                  # estado de los servicios
docker compose logs -f backend     # seguir logs del backend
docker compose restart backend     # reiniciar un servicio
docker compose down                # parar y eliminar contenedores
docker compose down -v             # además borra el volumen de datos (DB limpia)
```

> El backend aplica las migraciones de Alembic **automáticamente** al arrancar
> (`docker-entrypoint.sh`). Si cambias credenciales o el esquema queda
> inconsistente en dev, `docker compose down -v` y vuelve a subir.

> **Al añadir dependencias del frontend** (nuevas librerías en `package.json`),
> el contenedor `frontend` reutiliza un volumen anónimo con los `node_modules`
> antiguos y Vite fallará con `Failed to resolve import ...`. Fuerza su
> recreación:
> ```powershell
> docker compose up -d --build --renew-anon-volumes frontend
> ```

---

## Base de datos y migraciones

Consola SQL dentro del contenedor de Postgres:
```powershell
docker compose exec postgres psql -U numario -d numario
```

Comprobaciones rápidas (una línea):
```powershell
docker compose exec -T postgres psql -U numario -d numario -c "\dt"
docker compose exec -T postgres psql -U numario -d numario -c "SELECT version_num FROM alembic_version;"
docker compose exec -T postgres psql -U numario -d numario -c "\d users"
```

Alembic (dentro del contenedor del backend):
```powershell
docker compose exec backend uv run --no-sync alembic upgrade head     # aplicar todas
docker compose exec backend uv run --no-sync alembic current          # revisión actual
docker compose exec backend uv run --no-sync alembic downgrade -1     # deshacer una
```

---

## Backend: tests, lint y tipos

La suite de auth usa **SQLite en memoria**, así que **no necesita Postgres**.

### Opción A — en contenedor `uv` (no requiere instalar `uv`)

Es como lo ejecuto yo. Descarga la imagen de `uv`, instala deps y corre todo:

```bash
docker run --rm -v "//c/Users/mamay/Desktop/Numario/backend://app" -w //app \
  ghcr.io/astral-sh/uv:python3.13-bookworm-slim \
  bash -c "uv sync --frozen --quiet && uv run --no-sync ruff check . && uv run --no-sync mypy app && uv run --no-sync pytest"
```

Regenerar el lock tras tocar dependencias (`pyproject.toml`):
```bash
docker run --rm -v "//c/Users/mamay/Desktop/Numario/backend://app" -w //app \
  ghcr.io/astral-sh/uv:python3.13-bookworm-slim uv lock
```

> En PowerShell puro, sustituye las barras `//c/...://app` por la ruta al uso de
> Docker Desktop; desde **Git Bash** el formato de arriba funciona tal cual.

### Opción B — con el stack ya levantado
```powershell
docker compose exec backend uv run --no-sync pytest
docker compose exec backend uv run --no-sync ruff check .
docker compose exec backend uv run --no-sync mypy app
```

### Opción C — nativo (si tienes `uv` instalado)
```bash
cd backend
uv sync
uv run ruff check .
uv run mypy app
uv run pytest
```

### Cobertura y seguridad (Fase 6)
```bash
# Cobertura (gate: fail_under=80 en pyproject.toml)
docker compose exec backend uv run --no-sync pytest --cov
# Escaneo de seguridad
docker compose exec backend uv run --no-sync bandit -r app      # estático
docker compose exec backend uv run --no-sync pip-audit          # CVEs de deps
```

---

## Frontend: tests, lint, tipos y build

Nativo con Node/npm (el frontend no necesita Docker para los tests unitarios):
```bash
cd frontend
npm install          # solo la primera vez o al cambiar dependencias
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest (una pasada)
npm run test:coverage # Vitest con cobertura (gates en vite.config.ts)
npm run test:watch   # Vitest en modo watch
npm audit --audit-level=high  # CVEs de dependencias (Fase 6)
npm run build        # tsc -b + vite build (producción)
npm run dev          # servidor de desarrollo (si no usas Docker)
```

---

## E2E (Playwright)

Requiere el **stack levantado** (`docker compose up -d`) y el navegador de
Playwright instalado una vez:

```bash
cd frontend
npx playwright install chromium     # solo la primera vez
npm run test:e2e                    # corre e2e/auth.spec.ts contra localhost:5173
```

Opciones útiles:
```bash
npx playwright test --headed        # ver el navegador
npx playwright show-report          # informe HTML tras la ejecución
```

---

## Verificación manual de la API (curl)

Con el stack levantado, flujo de autenticación completo (Fase 2). En Git Bash:

```bash
BASE=http://localhost:8000/api/v1/auth

# Registro (nick único + contraseña robusta)
curl -s -X POST $BASE/register -H 'Content-Type: application/json' \
  -d '{"email":"carlos@mail.com","nickname":"carlos","password":"Str0ng!Pass"}'

# Login por email o por nick → guarda access_token y refresh_token
curl -s -X POST $BASE/login -H 'Content-Type: application/json' \
  -d '{"identifier":"carlos","password":"Str0ng!Pass"}'

# Endpoint protegido (sustituye <ACCESS>)
curl -s http://localhost:8000/api/v1/auth/me -H "Authorization: Bearer <ACCESS>"

# Refresh (rota; el refresh viejo deja de valer). Sustituye <REFRESH>
curl -s -X POST $BASE/refresh -H 'Content-Type: application/json' \
  -d '{"refresh_token":"<REFRESH>"}'

# Logout (revoca el refresh). Requiere Bearer
curl -s -X POST $BASE/logout -H "Authorization: Bearer <ACCESS>" \
  -H 'Content-Type: application/json' -d '{"refresh_token":"<REFRESH>"}'
```

Comprobaciones esperadas: registro `201`, contraseña débil `422`, nick duplicado
`409`, login `200`, `/me` sin token `401`, refresh reutilizado `401`, logout
`204`, y >5 logins/min → `429`.

---

## Checklist de verificación por fase

**Fase 1 (andamiaje)**
1. `docker compose up --build` levanta los 3 servicios.
2. `http://localhost:8000/health` → `{"status":"ok","db":"ok"}`.
3. `http://localhost:5173` carga la app.

**Fase 2 (autenticación)**
1. Backend en verde (Opción A/B/C): `ruff` + `mypy` + `pytest`.
2. Frontend en verde: `npm run lint`, `typecheck`, `test`, `build`.
3. Migraciones aplicadas: `alembic_version` = última revisión; existen
   `users` y `refresh_tokens`.
4. Flujo curl de auth con los códigos esperados de arriba.
5. E2E: `npm run test:e2e` en verde.

**Fase 3 (movimientos y categorías)**
1. Backend en verde: `ruff` + `mypy` + `pytest` (incluye tests de precisión
   `Decimal`).
2. Frontend en verde: `lint` + `typecheck` + `test` + `build`.
3. Migraciones `0004`/`0005` aplicadas: `\dt` muestra `categories` y
   `transactions`; hay 79 categorías semilla (`SELECT count(*) FROM categories`).
4. Flujo curl (con Bearer): listar categorías → crear movimiento → listar
   (orden reciente→antiguo) → filtrar por tipo/fecha → editar → borrar.
   `amount` debe viajar como **string** (`"42.90"`).
5. E2E: `npm run test:e2e` (alta de movimiento) en verde.

**Fase 4 (importación CSV + clasificación)**
1. Backend en verde: `ruff` + `mypy` + `pytest` (parser, clasificación,
   preview/confirm).
2. Frontend en verde: `lint` + `typecheck` + `test` + `build`.
3. Migración `0006` aplicada: `\dt` muestra `classification_rules`.
4. Import (con Bearer): subir el CSV a `/import/preview` y confirmar en
   `/import/confirm`:
   ```bash
   curl -s -X POST http://localhost:8000/api/v1/import/preview \
     -H "Authorization: Bearer <ACCESS>" -F "file=@extracto.csv"
   ```
   Debe clasificar MERCADONA→Supermercado, BIZUM→traspaso, marcar duplicados al
   repetir, y aprender la categoría al confirmar una corrección.
5. E2E: `npm run test:e2e` (importar un CSV) en verde.

**Fase 5 (análisis 50-30-20)**
1. Backend en verde: `ruff` + `mypy` + `pytest` (budget + analytics).
2. Frontend en verde: `lint` + `typecheck` + `test` + `build`.
3. Migración `0007` aplicada: `\dt` muestra `budgets`.
4. Análisis (con Bearer): crear ingreso + gasto + un `transfer`;
   `GET /analytics/overview?granularity=month&year=&month=` → `net = income −
   expense` (el `transfer` **no** cuenta); `PUT /budget` con `income` y % (deben
   sumar 100) y ver los cubos con presupuesto y semáforo.
5. E2E: `npm run test:e2e` (análisis) en verde.

> Este runbook se actualiza cuando una fase añade comandos nuevos (ver la tarea
> permanente en `CLAUDE.md` §8).
