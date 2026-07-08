# Glosario de funcionalidades — documento vivo

> **Propósito.** Registro acumulativo de **qué** se ha implementado en cada fase
> y **por qué**. Es la fuente rápida para la defensa del proyecto: de un vistazo
> se ve el recorrido y las decisiones de ingeniería.
>
> **Cómo se mantiene.** Al cerrar cada fase se añade su bloque aquí (ver la tarea
> permanente en `CLAUDE.md` §8). Estructura: primero **por fases** (narrativa
> cronológica), y al final una **vista transversal por áreas** (Tecnología,
> Seguridad, Testing, Diseño/UX) que se va rellenando.

## Índice

- [Fase 0 — Análisis y diseño](#fase-0--análisis-y-diseño)
- [Fase 1 — Andamiaje y DevOps](#fase-1--andamiaje-y-devops)
- [Fase 2 — Autenticación y seguridad base](#fase-2--autenticación-y-seguridad-base)
- [Vista transversal por áreas](#vista-transversal-por-áreas)
- [Leyenda de estado](#leyenda-de-estado)

---

## Fase 0 — Análisis y diseño

**Objetivo.** Definir el problema y el diseño antes de escribir código.

**Qué se hizo**
- **Personas de usuario** y sus frustraciones/objetivos (`docs/analysis/01-personas.md`).
- **User stories con priorización MoSCoW** y backlog (`docs/analysis/02-user-stories.md`).
- **Requisitos** funcionales y no funcionales, incluidos los de seguridad
  (RNF-01…05) (`docs/analysis/03-requisitos.md`).
- **Modelo de datos / ER** (`docs/architecture/01-modelo-datos.md`) y **contrato
  de la API REST** (`docs/architecture/02-contrato-api.md`).
- **ADR del stack tecnológico** (`docs/decisions/0001-stack-tecnologico.md`).

**Por qué.** El máster evalúa el análisis de necesidades y el diseño; tener el
contrato y el modelo cerrados evita retrabajo y da un objetivo claro a cada fase.

**Estado:** ✅ Completada.

---

## Fase 1 — Andamiaje y DevOps

**Objetivo.** Montar la infraestructura **antes** que las funcionalidades
("DevOps desde el día uno"): que `docker compose up` levante todo y el CI esté
en verde con un esqueleto mínimo funcionando de punta a punta.

**Qué se implementó**

Tecnología / infraestructura
- **Docker Compose** con 3 servicios: `postgres`, `backend`, `frontend`
  (`compose.yaml`), con healthcheck de Postgres y hot-reload en desarrollo.
- **Backend FastAPI** con endpoint **`/health`** que comprueba la conexión a la
  base de datos (`SELECT 1`) — sirve de sonda para Docker y monitorización.
- **SQLAlchemy 2.0 + Alembic**: base declarativa, sesión por petición, y primera
  migración `0001_create_users` (tabla `users`, PK UUID).
- **Frontend React + TypeScript + Vite + Tailwind v4 + shadcn/ui** arrancando,
  con una landing que consulta el estado del backend.
- **Gestión de dependencias del backend con `uv`** (`pyproject.toml` + `uv.lock`).

CI/CD
- **GitHub Actions** (`.github/workflows/ci.yml`): lint y tipos (ruff + mypy en
  backend; eslint + tsc en frontend) y ejecución de tests, con un Postgres de
  servicio para validar las migraciones.

**Por qué / decisiones**
- Levantar la infraestructura primero reduce el riesgo de integración y permite
  demostrar el área de infraestructura/cloud desde el inicio.
- **PK UUID** (regla §7.7) para evitar enumeración de recursos.
- `uv` por velocidad y reproducibilidad (`uv.lock`).

**Estado:** ✅ Completada.

---

## Fase 2 — Autenticación y seguridad base

**Objetivo.** Primer bloque funcional y de seguridad: **registro, login,
protección por JWT, refresh y logout**, aplicando **TDD**. Incluye el refuerzo de
registro pedido después (nick único, política de contraseña robusta, repetir
contraseña y rediseño de las pantallas).

**Qué se implementó**

Funcionalidad
- **Registro** con **email**, **nick de perfil obligatorio y único** y
  contraseña. El nick se normaliza a minúsculas (unicidad sin ambigüedad).
- **Login por email _o_ nick** (un único campo "identificador").
- **`/auth/me`**: endpoint protegido que devuelve el usuario autenticado.
- **Logout real**: revoca el refresh token en servidor.
- **Refresh con rotación**: cada renovación revoca el token usado y emite uno
  nuevo; reutilizar uno ya rotado falla.

Seguridad
- **Hash de contraseñas con argon2id** (`pwdlib`); nunca en claro.
- **Política de contraseña robusta** (`app/core/password_policy.py`, fuente de
  verdad): ≥ 8, mayúscula, minúscula, número y símbolo; se **rechazan
  contraseñas comunes** y las que **contengan el email o el nick**. Validada en
  backend y reflejada en el frontend para feedback en vivo.
- **JWT HS256** de vida corta para el access token; secreto por entorno (≥32 B).
- **Refresh tokens opacos** persistidos **solo como `sha256`**, revocables y
  rotables (si se filtra la DB, no se pueden reutilizar).
- **Rate limiting** en `/auth/login` (`slowapi`, 5/min por IP) contra fuerza
  bruta.
- **Verificación en tiempo constante** (hash señuelo) para no filtrar si un
  usuario existe (anti-enumeración).
- **Validación estricta con Pydantic** en todas las entradas.
- Trade-off de almacenamiento de tokens (localStorage + Bearer) y mitigaciones
  documentados en `docs/security/01-owasp-autenticacion.md`.

Diseño / UX (frontend)
- Enrutado con **react-router-dom**; **`AuthContext`** que persiste sesión en
  `localStorage`, inyecta `Authorization: Bearer` y **auto-refresca una vez** al
  recibir 401.
- Pantallas **Login / Register / Dashboard** con shadcn/ui; **`ProtectedRoute`**
  que redirige a `/login` sin sesión.
- **Medidor de fuerza** de contraseña + **checklist de requisitos en vivo**;
  campo **repetir contraseña**; el envío se bloquea hasta que la contraseña es
  válida y ambas coinciden.
- Mensajes de validación en **español** (incluida la traducción de los 422 del
  backend).

Datos / migraciones
- Modelo **`RefreshToken`** (hash único, `expires_at`, `revoked_at`, FK a
  usuario con `ON DELETE CASCADE`).
- Migraciones **`0002_create_refresh_tokens`** y **`0003_add_user_nickname`**
  (esta con backfill para datos previos). `User` migrado a tipo `Uuid` genérico
  para poder testear sobre SQLite en memoria.

Testing
- **Backend (TDD): 36 tests** — seguridad (hash/JWT), política de contraseña,
  registro, login (email y nick), refresh/rotación, logout, endpoint protegido y
  rate limiting.
- **Frontend: 17 tests** (Vitest) — cliente API (Bearer + retry de refresh),
  evaluador de contraseña, páginas y `ProtectedRoute`.
- **E2E (Playwright)**: registro → logout → login por nick → login por email.
- CI ampliado con un **job `e2e`** (levanta el stack y corre Playwright).

**Por qué / decisiones**
- **TDD** en auth y lógica sensible (regla §7.3): el test guía el diseño y
  documenta el comportamiento.
- **Refresh en DB** (no solo JWT) para poder **revocar** de verdad (logout) y
  **rotar** (mitiga robo de token) — el JWT puro no permite invalidar.
- **Nick único + login flexible** por UX; normalización a minúsculas por
  simplicidad (KISS, regla §7.5).
- **argon2id** frente a bcrypt por robustez actual; sin librerías de auth
  "todo-en-uno" (KISS): JWT + servicio propio.
- Backend como **única fuente de verdad** de la política de contraseña; el
  frontend solo replica para UX.

**Artefactos clave**
- Backend: `app/core/{security,password_policy,rate_limit}.py`,
  `app/schemas/auth.py`, `app/services/auth_service.py`, `app/api/deps.py`,
  `app/api/v1/auth.py`, `app/models/refresh_token.py`.
- Frontend: `src/lib/{api,password}.ts`, `src/context/AuthContext.tsx`,
  `src/components/{PasswordStrength,ProtectedRoute}.tsx`, `src/pages/*`.
- Docs: `docs/security/01-owasp-autenticacion.md`, contrato de API actualizado.

**Estado:** ✅ Completada.

---

## Vista transversal por áreas

Resumen acumulado; se amplía en cada fase.

### Tecnología
- FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · `uv` (backend).
- React 19 · TypeScript · Vite · Tailwind v4 · shadcn/ui · react-router-dom (frontend).
- Docker Compose (3 servicios) · GitHub Actions (CI).

### Seguridad
- argon2id · JWT HS256 · refresh opacos (sha256) rotables y revocables.
- Rate limiting en login · validación Pydantic · UUID como PK · secretos por
  entorno · anti-enumeración (tiempo constante) · política de contraseña.
- Mapeo OWASP en `docs/security/01-owasp-autenticacion.md`.

### Testing
- Backend: pytest (SQLite en memoria para la suite; Postgres real para
  migraciones en CI). 36 tests.
- Frontend: Vitest (17 tests) · Playwright E2E.
- Gates en CI: ruff, mypy, eslint, tsc, build.

### Diseño / UX
- Componentes shadcn/ui (button, input, label, card).
- Flujo de auth con rutas protegidas, medidor de fuerza y checklist en vivo.
- Mensajería en español.

---

## Leyenda de estado
- ✅ Completada · 🔄 En curso · ⏭️ Siguiente · ⏳ Pendiente
