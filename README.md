# Numario — Gestor de Finanzas Personales

> Aplicación web que ayuda a las personas a tomarse en serio su dinero sin
> abandonar por pereza o aburrimiento, aplicando la regla **50-30-20** y el
> concepto de **colchón de emergencia**, con clasificación inteligente de
> movimientos asistida por IA.

Proyecto final del Máster de Desarrollo de Software con IA.

---

## Índice

- [Propuesta de valor](#propuesta-de-valor)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Puesta en marcha (local)](#puesta-en-marcha-local)
- [Documentación](#documentación)
- [Estado del proyecto](#estado-del-proyecto)
- [Licencia](#licencia)

---

## Propuesta de valor

El problema: a la gente le preocupa gastar de más, pero en cuanto se olvida,
gasta sin control. Numario ataca ese olvido con **visibilidad continua** y
**alertas proactivas** de presupuesto.

Pilares funcionales:

- **Regla 50-30-20** — reparte los ingresos mensuales en gastos de vida (50%),
  gastos del mes (30%) e inversión (20%).
- **Colchón de emergencia** — objetivo de 3 a 6 meses de gastos de vida, con
  seguimiento de progreso.
- **Gestión de movimientos** — alta manual e importación desde CSV/XLS.
- **Clasificación inteligente** — motor de reglas + IA como respaldo, que
  aprende de las correcciones del usuario.
- **Dashboard** — respuesta clara a "¿estoy ahorrando o despilfarrando este mes?".

## Stack tecnológico

| Capa            | Tecnología                                             |
| --------------- | ------------------------------------------------------ |
| Frontend        | React + TypeScript + Vite + Tailwind CSS + shadcn/ui   |
| Backend         | FastAPI (Python)                                        |
| Base de datos   | PostgreSQL + SQLAlchemy 2.0 + Alembic                  |
| Autenticación   | JWT (access + refresh)                                  |
| IA              | Llamadas directas al modelo (clasificación en 2 capas) |
| Testing         | pytest · Vitest · Playwright                            |
| Contenerización | Docker + Docker Compose                                 |
| CI/CD           | GitHub Actions                                          |
| Despliegue      | Vercel (frontend) · Render (backend + PostgreSQL)      |

## Arquitectura

```
        React (TypeScript)
                │
            REST API
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

Ver detalle en [`docs/architecture/`](docs/architecture/).

## Estructura del repositorio

```
Numario/
├── frontend/            # Aplicación React + TypeScript
├── backend/             # API FastAPI + lógica de negocio
├── docs/
│   ├── analysis/        # Personas, user stories, requisitos
│   ├── architecture/    # Diagramas C4, modelo ER, contrato API
│   └── decisions/       # ADR (Architecture Decision Records)
├── .github/workflows/   # Pipelines de CI/CD
├── .gitignore
├── LICENSE
└── README.md
```

## Puesta en marcha (local)

Requisitos: **Docker + Docker Compose**.

```bash
cp .env.example .env          # ajusta los valores si lo necesitas
docker compose up --build     # levanta postgres + backend + frontend
```

- Frontend: http://localhost:5173
- API: http://localhost:8000 · documentación: http://localhost:8000/docs
- Health check: http://localhost:8000/health → `{"status":"ok","db":"ok"}`

El backend aplica las migraciones de Alembic automáticamente al arrancar.

### Desarrollo por servicio

Cada carpeta tiene su propio README con el flujo sin Docker:
- [`backend/README.md`](backend/README.md) — uv, migraciones, tests
- [`frontend/README.md`](frontend/README.md) — npm, Vite, tests

## Documentación

- **Glosario de funcionalidades (documento vivo)** — [`docs/glosario-funcionalidades.md`](docs/glosario-funcionalidades.md)
- **Comandos / runbook** — [`docs/comandos.md`](docs/comandos.md)
- **Análisis** — [`docs/analysis/`](docs/analysis/)
  - [Personas de usuario](docs/analysis/01-personas.md)
  - [User stories y backlog (MoSCoW)](docs/analysis/02-user-stories.md)
  - [Requisitos](docs/analysis/03-requisitos.md)
- **Arquitectura** — [`docs/architecture/`](docs/architecture/)
  - [Modelo entidad-relación](docs/architecture/01-modelo-datos.md)
  - [Contrato de la API](docs/architecture/02-contrato-api.md)
- **Decisiones** — [`docs/decisions/`](docs/decisions/)
  - [ADR-0001: Stack tecnológico](docs/decisions/0001-stack-tecnologico.md)

## Estado del proyecto

- Fase 0 — Análisis y diseño ✅
- Fase 1 — Andamiaje y DevOps ✅ (Docker Compose, FastAPI + `/health`,
  SQLAlchemy + Alembic, React + Vite + Tailwind + shadcn/ui, CI en GitHub Actions)
- Fase 2 — Autenticación y seguridad base ✅ (registro con nick único y política
  de contraseña robusta, login por email/nick, JWT + refresh rotables y
  revocables, argon2id, rate limiting; TDD backend, Vitest y E2E Playwright)
- Fase 3 — Núcleo de movimientos y categorías ✅ (CRUD de movimientos con
  `Decimal`, categorías semilla 50-30-20, listado ordenado y filtros; pantalla
  de movimientos con alta/edición en diálogo; TDD, Vitest y E2E)
- Fase 4 — Importación CSV e inteligencia ✅ (import de extractos con preview y
  deduplicación; clasificación por reglas + aprendizaje, sin IA externa de pago)
- Fase 5 — Análisis / Dashboard ✅ (ingresos vs gastos vs neto excluyendo lo no
  computable; 50-30-20 con porcentajes configurables y semáforo; gasto por
  categoría; periodos meses/años)
- Fase 6 — Endurecimiento, calidad y cobertura ⏭️ (siguiente)

### Autenticación (Fase 2)

- API bajo `/api/v1/auth`: `register`, `login`, `refresh`, `logout`, `me`.
- Detalle de seguridad en [`docs/security/01-owasp-autenticacion.md`](docs/security/01-owasp-autenticacion.md).
- E2E: con el stack levantado, `cd frontend && npx playwright install chromium && npm run test:e2e`.

Ver hoja de ruta completa en el plan de trabajo del proyecto.

## Licencia

Distribuido bajo licencia MIT. Ver [`LICENSE`](LICENSE).
