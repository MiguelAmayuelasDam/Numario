# CLAUDE.md — Guía del proyecto para Claude Code

> Este fichero es la memoria persistente del proyecto. Léelo al inicio de cada
> sesión para cargar todo el contexto. Amplía la información en `docs/`.

---

## 1. Qué es Numario

**Numario** (Finanzas Personales) es un gestor de finanzas personales web.
Es el **proyecto final del Máster de Desarrollo de Software con IA** y debe
demostrar aprendizaje en seis áreas: análisis de necesidades, diseño y
arquitectura de software, flujos de desarrollo con IA, calidad de código,
infraestructura/cloud y seguridad.

### El problema que resuelve
A la gente le preocupa gastar de más, pero en cuanto se olvida, gasta sin
control. Numario ataca ese olvido con **visibilidad continua** y **alertas
proactivas** de presupuesto, sin que la app sea tan tediosa que se acabe
abandonando por pereza o aburrimiento.

### Pilares funcionales
- **Regla 50-30-20**: reparte el ingreso mensual en gastos de vida (50%),
  gastos del mes (30%) e inversión (20%).
- **Colchón de emergencia**: objetivo de 3–6 meses de gastos de vida, con
  seguimiento de progreso.
- **Gestión de movimientos**: alta manual e importación desde CSV/XLS.
- **Clasificación inteligente**: motor de reglas + IA como respaldo, que
  aprende de las correcciones del usuario.
- **Dashboard**: responde a "¿estoy ahorrando o despilfarrando este mes?".

---

## 2. Stack tecnológico

| Capa            | Tecnología                                             |
| --------------- | ------------------------------------------------------ |
| Frontend        | React + TypeScript + Vite + Tailwind CSS + shadcn/ui   |
| Backend         | FastAPI (Python)                                        |
| Base de datos   | PostgreSQL + SQLAlchemy 2.0 + Alembic                  |
| Autenticación   | JWT (access + refresh)                                  |
| IA              | Llamadas directas al modelo (OpenAI/Gemini), sin LangChain en v1 |
| Testing         | pytest (backend) · Vitest (frontend) · Playwright (E2E)|
| Contenerización | Docker + Docker Compose                                 |
| CI/CD           | GitHub Actions                                          |
| Despliegue      | Vercel (frontend) · Render (backend, Docker) · Neon (PostgreSQL) |

Justificación detallada en `docs/decisions/0001-stack-tecnologico.md`.

---

## 3. Arquitectura

```
        React (TypeScript)
                │
            REST API  (/api/v1)
                │
        FastAPI (Python)
        ├── Auth
        ├── Transactions
        ├── Categories
        ├── Analytics
        ├── AI Service
        └── Import Service
                │
           PostgreSQL
                │
        OpenAI / Gemini API
```

- Modelo de datos y diagrama ER: `docs/architecture/01-modelo-datos.md`
- Contrato de la API REST: `docs/architecture/02-contrato-api.md`

---

## 4. Estructura del repositorio

```
Numario/
├── frontend/            # React + TS + Vite + Tailwind v4 + shadcn/ui
│   ├── src/             # components · pages · context · lib
│   └── e2e/             # Suite E2E (Playwright, 7 specs)
├── backend/             # FastAPI (dependencias con uv)
│   ├── app/             # api · core · db · models · schemas · services
│   ├── alembic/         # Migraciones (hasta 0011)
│   └── tests/           # pytest
├── docs/
│   ├── analysis/        # Personas, user stories (MoSCoW), requisitos
│   ├── architecture/    # Modelo ER, contrato API
│   ├── decisions/       # ADR (decisiones de arquitectura)
│   └── security/        # OWASP: autenticación + Top 10
├── .github/workflows/   # CI: backend · frontend · e2e · security
├── compose.yaml         # Docker Compose: frontend + backend + postgres
├── .env.example         # Plantilla de variables de entorno (sin secretos)
├── .gitignore
├── LICENSE
├── README.md
└── CLAUDE.md            # Este fichero
```

---

## 5. Plan de trabajo por fases

El proyecto se ejecuta en 7 fases secuenciales. **Estado actual: Fase 7 en curso**
(bloque A — preparación del código — completado; pendiente desplegar y la
documentación de defensa).

### Fase 0 — Análisis y diseño ✅
Personas, user stories con MoSCoW, requisitos, modelo ER, contrato de API y ADR
del stack. Todo en `docs/`.

### Fase 1 — Andamiaje y DevOps desde el día uno ✅
Infraestructura montada antes que las features:
- Docker Compose con 3 servicios: `frontend`, `backend`, `postgres`.
- FastAPI con endpoint `/health` (comprueba la conexión a PostgreSQL).
- SQLAlchemy 2.0 + Alembic con la primera migración (`0001_create_users`).
- React + Vite + TS + Tailwind v4 + shadcn/ui arrancando.
- GitHub Actions (`.github/workflows/ci.yml`): lint (ruff/mypy · eslint/tsc) + tests.
- Dependencias del backend gestionadas con **uv** (`pyproject.toml` + `uv.lock`).
- **Hito:** `docker compose up` levanta todo y el CI está en verde.

### Fase 2 — Autenticación y seguridad base (TDD) ✅
Registro/login con JWT aplicando TDD. Hash con **argon2id** (`pwdlib`),
validación Pydantic, **rate limiting** en login (`slowapi`), secretos por
entorno. **Nick de perfil obligatorio y único**; login por email **o** nick.
**Política de contraseña robusta** (complejidad + bloqueo de comunes + no
contener email/nick) validada en backend y frontend, con medidor de fuerza.
Refresh tokens **persistidos, rotables y revocables**. E2E de login con
Playwright.
- **Hito:** registro + login funcionando, cubiertos por tests unitarios y E2E. ✅

### Fase 3 — Núcleo de movimientos y categorías ✅
Modelos `Category` y `Transaction` con `Decimal` (nunca float; string en JSON).
Categorías semilla globales mapeadas a los cubos 50-30-20 (migración `0004`) +
categorías propias del usuario. CRUD completo de movimientos, listado ordenado
(reciente → antiguo) con filtros (tipo/categoría/fechas), pantalla `/movimientos`
con alta/edición en diálogo y borrado. Aislamiento por usuario. Tests unitarios
(61 backend · 24 frontend) y E2E del alta.
- **Hito:** gestión manual de movimientos de principio a fin. ✅

### Fase 4 — Importación CSV e inteligencia ✅
Importación CSV robusta (formato imagin/CaixaBank; parseo tolerante, preview
antes de confirmar, deduplicación, manejo de errores). Clasificación en **dos
capas SIN IA de pago** (decisión del usuario): motor de **reglas** (diccionario
de comercios) + **aprendizaje** de las correcciones (tabla `classification_rule`).
La capa de IA queda **pluggable pero apagada** (`ai_provider="none"`) como punto
de extensión. Tests con CSVs de ejemplo, incluidos malformados.
- **Hito:** importar un extracto real y que se clasifique razonablemente solo. ✅

### Fase 5 — Dashboard / Análisis (50-30-20) ✅
Pantalla `/analisis`: **Ingresos vs Gastos vs Neto** del periodo (excluye lo No
computable, `type=transfer`), **reparto 50-30-20 con porcentajes configurables**
por el usuario (default 50/30/20, deben sumar 100) y semáforo por cubo, desglose
de gasto por categoría, y periodos **Meses/Años** con navegador de mini-barras.
Modelo `Budget` (migración `0007`) + `analytics_service`. El **colchón de
emergencia** y semanas/trimestres quedan fuera de esta fase.
- **Hito:** el dashboard responde a "¿ahorro o despilfarro este mes?". ✅

### Fase 6 — Endurecimiento, calidad y cobertura ✅
Refactor guiado por KISS, eliminación de code smells, cobertura ≥ 70% en lógica
de negocio (gates: backend `fail_under=80` ~97% · frontend `@vitest/coverage-v8`),
suite E2E de los happy paths (7 specs), escaneo de seguridad en CI (Bandit,
pip-audit, npm audit — 0 hallazgos), revisión del OWASP Top 10 documentada
(`docs/security/02-owasp-top-10.md`) + endurecimientos (cabeceras de seguridad,
límite de subida CSV).
- **Hito:** código limpio, CI con gates de calidad y seguridad. ✅

### Fase 7 — Despliegue y documentación de defensa 🔄

**Requisito que manda:** la app debe estar **desplegada de forma continua** (el
profesor corrige en una fecha no acordada; previsión **23-24 ago 2026**) y debe
poder **seguir recibiendo ampliaciones** después de la entrega.

#### Arquitectura de despliegue (decidida verificando los límites reales)

| Pieza | Dónde | Por qué |
| ----- | ----- | ------- |
| Frontend | **Vercel** | Gratis, siempre activo, auto-deploy desde `main` |
| Backend | **Render** — Docker, **plan de pago** | No se duerme → sin arranque en frío |
| Base de datos | **Neon** (Postgres) | Free **permanente**: no caduca |

> ⚠️ **NO usar la Postgres gratuita de Render**: **caduca a los 30 días** (+14 de
> gracia) y después **se borra con todos los datos** → incompatible con "siempre
> desplegado". Creada hoy, moriría *antes* de la corrección.
>
> ⚠️ El plan **web free** de Render se duerme a los 15 min (~1 min de arranque en
> frío). Se descarta por eso; alternativa gratis post-entrega: bajar a free +
> pinger externo cada ~10 min contra `/ping` (750 h/mes cubren 24/7).

#### Bloque A — Preparar el código ✅
- Entrypoint: puerto desde **`$PORT`** (lo inyecta Render), con caída a 8000 en local.
- **`GET /ping`**: liveness **sin BD** → es el *Health Check Path* de Render.
  Sondear `/health` (hace `SELECT 1`) mantendría a **Neon despierta 24/7** y
  agotaría sus **100 h de cómputo/mes**.
- **Guarda**: la app no arranca si `ENVIRONMENT=production` con el JWT de dev.
- **`frontend/vercel.json`**: rewrites SPA (sin ellos, refrescar `/movimientos` → 404).
- `.env.example`: variables exactas de producción.

#### Bloque B — Desplegar (las cuentas y los secretos los pone el autor)
1. **Neon**: crear proyecto y copiar la cadena. Viene como `postgresql://` → usar
   **`postgresql+psycopg://…?sslmode=require`**.
2. **Render**: Web Service · Docker · **Root Directory `backend`** · plan de pago.
   Variables: `DATABASE_URL`, `JWT_SECRET_KEY` (nuevo y aleatorio),
   `ENVIRONMENT=production`, `RATE_LIMIT_LOGIN=5/minute`, `CORS_ORIGINS`.
   **Health Check Path: `/ping`**. Las migraciones se aplican solas (el entrypoint
   ejecuta `alembic upgrade head` al arrancar).
3. **Vercel**: importar repo · **Root Directory `frontend`** ·
   `VITE_API_URL` = URL de Render (se usa **al compilar**).
4. **Cerrar el círculo**: `CORS_ORIGINS` ← URL de Vercel.
5. **Verificar en producción**: registro → login → movimiento → análisis → colchón.

#### Bloque C — Ensayo de la demo
- Sembrar datos: portar `backend/scripts/seed_demo.py` (hoy en la rama `demo`).
- Con Render de pago no hay arranque en frío; Neon despierta en <1 s.

#### Bloque D — Documentación de defensa
- **README completo**: qué es, arquitectura, **URLs de producción**, cómo
  levantarlo, capturas. (Incluir el cambio pendiente `CSV/XLS` → `CSV`.)
- **ADR `0002-despliegue.md`**: por qué Vercel + Render de pago + Neon, y **por
  qué NO la Postgres free de Render**; coste y plan post-entrega.
- Glosario + comandos (tarea permanente §8).

#### CI/CD para las ampliaciones
`main` queda conectada a Vercel y Render → **rama → PR → CI verde → merge a
`main` → se despliega solo y migra la BD sola**. Cuidado con migraciones
destructivas: se aplican automáticamente sobre la BD de producción.

- **Hito:** proyecto en producción (accesible de forma continua) + material de
  defensa listo.

---

## 6. Core obligatorio (checklist)

- [x] Registro/login
- [x] Gestión de movimientos
- [x] Categorías
- [x] Dashboard financiero
- [x] Regla 50-30-20
- [x] Importación CSV
- [x] Clasificación inteligente (reglas + aprendizaje; sin IA de pago)
- [x] Tests (123 backend · 45 frontend · 7 E2E; cobertura con gates)
- [x] Docker (Docker Compose: frontend + backend + postgres)
- [x] CI/CD básico (GitHub Actions: lint, tipos, tests, cobertura, seguridad, E2E)
- [x] Seguridad básica (auth, OWASP Top 10, escaneo de deps + estático en CI)

Alcance por prioridad (MoSCoW) en `docs/analysis/02-user-stories.md`.

---

## 7. Decisiones y reglas de ingeniería (IMPORTANTE)

Estas reglas deben respetarse siempre al escribir código:

1. **Dinero con `Decimal`/`NUMERIC`, nunca `float`.** En JSON, los importes
   viajan como string decimal para no perder precisión.
2. **Clasificación IA en dos capas y en lote.** Primero motor de reglas
   (diccionario/keywords); solo si no hay confianza suficiente, se llama a la
   IA, y al importar se manda **una sola llamada** con todos los pendientes.
3. **TDD** obligatorio en autenticación y lógica financiera (test antes del
   código).
4. **Seguridad shift-left**: validación con Pydantic, secretos solo en variables
   de entorno (nunca en el repo), rate limiting en login, escaneo de
   dependencias en CI.
5. **KISS**: preferir la solución simple. Sin LangChain ni abstracciones
   innecesarias en la v1.
6. **PDF fuera de la v1** (alta complejidad); CSV y XLS sí.
7. Claves primarias `uuid` para evitar enumeración de recursos.
8. **Colores por tokens semánticos, nunca hex sueltos.** La identidad vive en
   `frontend/src/index.css`: tokens de tema (shadcn) + los del dinero
   (`--income`, `--expense`, `--invest`, `--bucket-amber`), usables como
   utilidades (`text-income`, `bg-income`…), en claro y oscuro. **Verde y rojo
   están reservados a su significado** (ingreso/gasto), por eso el acento de
   marca es **azul tinta**. Tipografía **Archivo** autohospedada (`@fontsource`)
   y **`tabular-nums`** en los importes. Cambiar un color = una línea.

---

## 8. Convenciones de trabajo

- **Ramas**: trabajar cada fase/feature en una rama; `main` protegida; integrar
  vía Pull Request (aunque el proyecto sea individual).
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`,
  `test:`, `refactor:`).
- **Tests**: no dejarlos para el final; acompañan a cada feature.
- **Alcance**: toda funcionalidad debe ayudar a demostrar alguna de las seis
  áreas del temario; lo que no, va al final del backlog.
- **📌 TAREA PERMANENTE — Documentos vivos.** Al cerrar cada fase (o al añadir
  una funcionalidad relevante) **actualizar siempre**:
  1. `docs/glosario-funcionalidades.md` — añadir qué se implementó y **por qué**
     (bloque de la fase + vista transversal por áreas).
  2. `docs/comandos.md` — si la fase introduce comandos nuevos (tests, scripts,
     migraciones, servicios), reflejarlos en el runbook.
  No cerrar una fase sin haber actualizado ambos documentos.

---

## 9. Documentación de referencia

> **Este es el índice único de la documentación.** El `README.md` **no** lo
> duplica: allí solo va lo que pide la entrega del TFM (descripción, stack,
> instalación, estructura, funcionalidades y usuario de prueba). Si añades un
> documento a `docs/`, enlázalo **aquí**.
>
> **No en el repo:** `docs/presentacion/` (guiones de las slides y del vídeo)
> está en `.gitignore` a propósito — son notas de defensa, no documentación del
> producto. Existen solo en el disco del autor; no los enlaces desde aquí.

**Documentos vivos** (ver tarea permanente en §8)
- [`docs/glosario-funcionalidades.md`](docs/glosario-funcionalidades.md) — qué se
  ha hecho en cada fase y **por qué** + vista transversal por áreas
- [`docs/comandos.md`](docs/comandos.md) — **runbook**: Docker, tests, cobertura,
  migraciones, E2E, seguridad y seed de demostración

**Análisis** (Fase 0)
- [`docs/analysis/01-personas.md`](docs/analysis/01-personas.md) — personas de usuario
- [`docs/analysis/02-user-stories.md`](docs/analysis/02-user-stories.md) — user stories + priorización MoSCoW
- [`docs/analysis/03-requisitos.md`](docs/analysis/03-requisitos.md) — requisitos funcionales y no funcionales

**Arquitectura**
- [`docs/architecture/01-modelo-datos.md`](docs/architecture/01-modelo-datos.md) — modelo entidad-relación
- [`docs/architecture/02-contrato-api.md`](docs/architecture/02-contrato-api.md) — contrato de la API REST

**Decisiones (ADR)**
- [`docs/decisions/0001-stack-tecnologico.md`](docs/decisions/0001-stack-tecnologico.md) — por qué este stack

**Seguridad**
- [`docs/security/01-owasp-autenticacion.md`](docs/security/01-owasp-autenticacion.md) — controles de seguridad de auth
- [`docs/security/02-owasp-top-10.md`](docs/security/02-owasp-top-10.md) — mapeo OWASP Top 10
  (mitigaciones, huecos y decisiones conscientes: `/docs` público, guarda de arranque)

---

## 10. Entorno de desarrollo (cosas que saber)

Aprendido a base de tropezar; léelo antes de ejecutar nada.

- El fichero de Compose es **`compose.yaml`** (no `docker-compose.yml`).
- **Backend:** el `.venv` del host apunta al intérprete del contenedor (symlink
  roto fuera de Docker). Los tests y herramientas se corren **dentro**:
  `docker compose exec backend uv run --no-sync pytest` (ver `docs/comandos.md`).
- **Frontend:** valida con **`npm ci`**, no `npm install`. El CI instala desde el
  lockfile y un `node_modules` desincronizado **oculta errores de lint que sí
  fallan en CI**.
- Al **añadir una dependencia del frontend**, instálala también en el contenedor
  (`node_modules` es un volumen anónimo):
  `docker exec numario-frontend-1 npm i <pkg>` y reinicia el contenedor.
- **`RATE_LIMIT_LOGIN` está relajado a 1000/min en `compose.yaml`** (dev/E2E: la
  suite hace ~6 logins en paralelo y el límite real de 5/min la tumbaba). El rate
  limiting **sí** se verifica en `tests/test_rate_limit.py` (fija su propio
  umbral) y en producción se define por entorno.
- **Rama `demo`** (solo local, no está en el remoto): contiene un **script de
  seed** (`backend/scripts/seed_demo.py`) y la **configuración para Cloudflare
  Tunnel** (API relativa + `allowedHosts`), reutilizables para el ensayo de demo
  de la Fase 7.
