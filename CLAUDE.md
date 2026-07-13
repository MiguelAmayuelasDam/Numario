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
| Despliegue      | Vercel (frontend) · Render (backend + PostgreSQL)      |

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
├── frontend/            # React + TypeScript (se inicializa en Fase 1)
├── backend/             # FastAPI + lógica de negocio (se inicializa en Fase 1)
├── docs/
│   ├── analysis/        # Personas, user stories (MoSCoW), requisitos
│   ├── architecture/    # Modelo ER, contrato API
│   └── decisions/       # ADR (decisiones de arquitectura)
├── .github/workflows/   # Pipelines de CI/CD
├── .env.example         # Plantilla de variables de entorno (sin secretos)
├── .gitignore
├── LICENSE
├── README.md
└── CLAUDE.md            # Este fichero
```

---

## 5. Plan de trabajo por fases

El proyecto se ejecuta en 7 fases secuenciales. **Estado actual: Fase 6
completada; siguiente, Fase 7.**

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

### Fase 7 — Despliegue y documentación de defensa
Deploy en Vercel (front) y Render (back + DB) con secretos bien gestionados.
README completo, ADR, ensayo de la demo (precargar el backend para evitar el
arranque frío de Render).
- **Hito:** proyecto en producción + material de defensa listo.

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

- `docs/glosario-funcionalidades.md` — **documento vivo**: qué se ha hecho en
  cada fase y por qué (ver tarea permanente en §8)
- `docs/comandos.md` — **runbook**: comandos para Docker, tests, migraciones, E2E
- `docs/analysis/01-personas.md` — personas de usuario
- `docs/analysis/02-user-stories.md` — user stories + priorización MoSCoW
- `docs/analysis/03-requisitos.md` — requisitos funcionales y no funcionales
- `docs/architecture/01-modelo-datos.md` — modelo entidad-relación
- `docs/architecture/02-contrato-api.md` — contrato de la API REST
- `docs/decisions/0001-stack-tecnologico.md` — ADR del stack
- `docs/security/01-owasp-autenticacion.md` — controles de seguridad de auth
- `docs/security/02-owasp-top-10.md` — mapeo OWASP Top 10 (mitigaciones + huecos)
