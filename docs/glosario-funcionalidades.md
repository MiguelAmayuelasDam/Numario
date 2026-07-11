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
- [Fase 3 — Núcleo de movimientos y categorías](#fase-3--núcleo-de-movimientos-y-categorías)
- [Fase 4 — Importación CSV + clasificación](#fase-4--importación-csv--clasificación)
- [Fase 5 — Análisis / Dashboard (50-30-20)](#fase-5--análisis--dashboard-50-30-20)
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

## Fase 3 — Núcleo de movimientos y categorías

**Objetivo.** Primer bloque de dominio financiero: **gestión manual de
movimientos y categorías** de principio a fin (US-06, US-07, US-08, US-09 Must;
US-10 filtros, Should). Base para la importación CSV (Fase 4) y el dashboard
50-30-20 (Fase 5).

**Qué se implementó**

Funcionalidad
- **Categorías** con **emoji** y mapeadas a los cubos 50-30-20
  (`living`/`monthly`/`investment`/`income`) más `transfer` (no computable):
  **79 semilla globales** por defecto + categorías propias del usuario
  (crear/editar/borrar las suyas).
- **Movimientos (CRUD completo)**: alta manual, listado **ordenado de más
  reciente a más antiguo** y **agrupado por fecha**, edición y borrado.
- Tres tipos de movimiento: **Gasto**, **Ingreso** y **No computable**
  (`transfer`: traspaso entre cuentas, ni gasto ni ingreso).
- **Dividir un movimiento** en varias partes por categoría (p. ej. un Bizum de
  7 € = 5 € comida + 2 € gasolina). Endpoint `POST /transactions/{id}/split`;
  las partes deben sumar **exactamente** el importe original (si no, `422`).
- **Filtros** por fecha (inicio→fin, sin fechas futuras) y categoría (servidor) +
  **buscador por concepto** y **pestañas** por tipo (cliente).
- Asignación de categoría a cada movimiento (opcional).

Datos / reglas
- Modelos **`Category`** y **`Transaction`**; `amount` es **`NUMERIC(12,2)` /
  `Decimal`, nunca float**, y viaja en JSON como **string** (`"42.90"`) para no
  perder precisión (regla §7.1).
- Migraciones **`0004_create_categories`** (crea la tabla y **siembra** las
  globales desde `app/db/default_categories.py`, fuente única de verdad) y
  **`0005_create_transactions`** (con índice `(user_id, occurred_on)`).
- Categoría por defecto **global** (`user_id = NULL`, `is_default = true`),
  compartida; borrar una categoría deja el movimiento sin clasificar
  (`ON DELETE SET NULL`).

Seguridad / API
- Todos los endpoints bajo `/api/v1` **protegidos** con `get_current_user`; cada
  usuario solo ve y toca **lo suyo** (movimiento ajeno → 404; categoría por
  defecto no editable → 403; categoría ajena en un movimiento → 422).
- Validación estricta (importe > 0, `type` ∈ {income, expense}, `bucket` válido).

Diseño / UX (frontend)
- Pantalla **`/movimientos`** (protegida) estilo Fintonic: filtros de fecha
  (con placeholder "Inicio/Fin", sin futuro, y botón para limpiarlas) y categoría
  (con emoji), buscador, pestañas Todos/Gastos/Ingresos/No computable, y
  **listado agrupado por fecha** con filas emoji + **punto de color por cubo**
  (Vida=verde, Mes=amarillo, Inversión=azul…) + concepto (remarcado) + categoría
  (atenuada) + importe (formateado en es-ES, con signo según el tipo).
- **Fila desplegable (acordeón)** en vez de ventana flotante: al clicar muestra
  el detalle y las acciones **Editar / Dividir / Borrar** en línea. Alta con
  botón **"Añadir movimiento"** (diálogo).
- **Mensajes de error específicos por campo** en login/registro (email, nick,
  contraseña) con **borde rojo** en el campo en conflicto.
- Componentes shadcn: **dialog**, **select**, **table**; validación en cliente.
- Enlace desde el Dashboard a Movimientos.

Testing
- **Backend (TDD): 66 tests** — categorías, movimientos (CRUD, orden, filtros,
  permisos, validaciones), **precisión Decimal**, **split** (suma exacta) y nick
  con tildes.
- **Frontend: 28 tests** (Vitest) — formulario, página de movimientos (listar,
  crear, borrar, buscar, pestañas), **split** y mensajes de error por campo.
- **E2E (Playwright)**: registro → movimientos → alta de un movimiento → verlo
  en el listado.

**Por qué / decisiones**
- **Decimal/NUMERIC + string en JSON**: precisión monetaria innegociable
  (regla §7.1); el frontend manda un decimal válido y el backend lo **cuantiza**
  a 2 decimales (fuente de verdad).
- **Categorías globales** en vez de copiarlas por usuario: KISS, sin duplicar
  datos ni tocar el registro.
- **`category_id` opcional** en el movimiento: necesario para la importación de
  la Fase 4 (movimientos pendientes de clasificar).

**Artefactos clave**
- Backend: `app/models/{category,transaction}.py`, `app/db/default_categories.py`,
  `app/services/{category_service,transaction_service}.py`,
  `app/api/v1/{categories,transactions}.py`, migraciones `0004`/`0005`.
- Frontend: `src/pages/Transactions.tsx`, `src/components/TransactionForm.tsx`,
  `src/components/ui/{dialog,select,table}.tsx`, ampliación de `src/lib/api.ts`.

**Estado:** ✅ Completada.

---

## Fase 4 — Importación CSV + clasificación

**Objetivo.** Importar extractos bancarios en CSV con **previsualización antes de
confirmar** (US-11, US-12) y **clasificación automática** que aprende de las
correcciones, **sin depender de IAs externas de pago** (decisión del usuario).

**Qué se implementó**

Funcionalidad
- **Importación CSV** (formato imagin/CaixaBank): subir extracto → **preview**
  con categoría sugerida por fila, tipo, importe y **duplicados marcados** →
  corregir → **confirmar**. Nada se persiste hasta confirmar.
- **Clasificación en dos capas sin IA de pago**: 1) reglas **aprendidas** del
  usuario (`classification_rule`, alimentadas por sus correcciones); 2) reglas
  **semilla** (diccionario de ~80 comercios españoles → categoría). Lo no
  reconocido queda "a revisar" y, al categorizarlo, **se aprende**.
- **Deduplicación**: marca filas que ya existen (misma fecha, importe, tipo y
  concepto) para no reimportarlas.

Backend
- Parser **tolerante** (`csv_import.py`): ignora metadatos, detecta la cabecera,
  entiende el formato español (`-6,40EUR`, `11.766,93EUR`), `dd/mm/yyyy`, y
  reporta filas malformadas sin romper. Encoding utf-8/cp1252. **Decimal**, no
  float; el signo decide gasto/ingreso; traspasos → `transfer`.
- Motor de clasificación (`classification.py`) con **capa de IA pluggable
  apagada** (`ai_provider="none"`) como punto de extensión; coste 0.
- Modelo `ClassificationRule` + migración `0006`; endpoints `POST /import/preview`
  y `POST /import/confirm` (aprende al confirmar).

Diseño / UX (frontend)
- Pantalla **`/importar`**: subir archivo, resumen (total/clasificados/a revisar/
  duplicados), tabla editable (categoría por fila con emoji, incluir/excluir,
  badge "Duplicado" y "aprendida"), **"Confirmar importación (N)"**. Enlace desde
  Movimientos.

Testing
- **Backend: 86 tests** — parser (número español, signo, traspaso, malformados,
  encoding), clasificación (semilla/aprendida/none), preview (dedup + summary) y
  confirm (persiste + aprende).
- **Frontend: N tests** (Vitest) — preview y confirmación. **E2E** Playwright:
  subir CSV → preview → confirmar → ver los movimientos importados.

**Por qué / decisiones**
- **Sin IA externa de pago**: el motor de reglas + aprendizaje cubre el caso y es
  gratis, offline y desplegable en Render free. La arquitectura deja el hueco de
  IA por si en el futuro se quiere (Ollama local o free-tier), pero **apagado**.
- **CSV centrado en imagin** con parser tolerante (no genérico multibanco): más
  robusto y suficiente para la demo.

**Estado:** ✅ Completada.

---

## Fase 5 — Análisis / Dashboard (50-30-20)

**Objetivo.** Responder a *"¿ahorro o despilfarro este mes?"* (US-17, US-18,
US-21, US-22). Referencia visual: la pantalla "Análisis" de Fintonic.

**Qué se implementó**

Funcionalidad
- **Ingresos vs Gastos vs Neto** del periodo (lo más importante). Cuenta todo
  (ingresos y gastos de Vida/Mes/Inversión) y **excluye lo No computable**
  (`type = transfer`).
- **Reparto 50-30-20 configurable**: el usuario fija su **ingreso mensual** y los
  **porcentajes** de Vida/Mes/Inversión (50/30/20 por defecto; puede poner
  65-25-10…; deben sumar 100). Semáforo por cubo (verde/ámbar/rojo) según el
  consumo del presupuesto.
- **Desglose de gastos por categoría** (ordenado desc, con emoji y color de cubo).
- **Periodos Meses y Años**, con **navegador de mini-barras** ingresos/gastos.

Backend
- Modelo `Budget` (ingreso + 3 % configurables, uno por usuario) + migración
  `0007`; `budget_service` (get/upsert, validación suma 100).
- `analytics_service`: `overview` (summary + cubos + categorías, excluye
  `transfer`) y `series` (mini-barras). Endpoints `/budget` y `/analytics/*`.

Diseño / UX (frontend)
- Pantalla **`/analisis`**: selector Meses/Años, navegador, cifras Ingresos/
  Gastos/Neto, cubos 50-30-20 con semáforo y **"Ajustar presupuesto"** (diálogo
  con validación suma 100), y gastos por categoría. Gráficos con SVG/divs propios
  (sin dependencia nueva). Enlaces desde Dashboard y Movimientos.

Testing
- **Backend: 95 tests** — budget (suma 100), analytics (excluye `transfer`, neto,
  cubos con presupuesto configurable, orden por categoría, series).
- **Frontend: 33 tests** (Vitest) + **E2E** que verifica que el `transfer` no
  cuenta en el neto.

**Por qué / decisiones**
- **Excluir `transfer`** en todo el análisis (regla del usuario: "si no es
  computable, nada").
- **50-30-20 configurable**: la regla es estándar, pero el usuario decide su
  propio reparto.
- **Colchón de emergencia** y **semanas/trimestres**: fuera de esta fase.

**Estado:** ✅ Completada.

---

## Vista transversal por áreas

Resumen acumulado; se amplía en cada fase.

### Tecnología
- FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · `uv` (backend).
- React 19 · TypeScript · Vite · Tailwind v4 · shadcn/ui · react-router-dom (frontend).
- Docker Compose (3 servicios) · GitHub Actions (CI).
- Dinero con **`Decimal`/`NUMERIC`** (nunca float); importes como string en JSON.

### Seguridad
- argon2id · JWT HS256 · refresh opacos (sha256) rotables y revocables.
- Rate limiting en login · validación Pydantic · UUID como PK · secretos por
  entorno · anti-enumeración (tiempo constante) · política de contraseña.
- Aislamiento por usuario en todos los recursos (movimientos/categorías propios).
- Mapeo OWASP en `docs/security/01-owasp-autenticacion.md`.

### Testing
- Backend: pytest (SQLite en memoria para la suite; Postgres real para
  migraciones en CI). **95 tests**.
- Frontend: Vitest (**33 tests**) · Playwright E2E (auth + movimientos +
  importación + análisis).
- Gates en CI: ruff, mypy, eslint, tsc, build.

### Diseño / UX
- **Tema claro/oscuro** con toggle, persistencia (localStorage) y respeto de la
  preferencia del sistema; sin parpadeo al cargar.
- Componentes shadcn/ui (button, input, label, card, dialog, select, table,
  popover, calendar).
- Flujo de auth con rutas protegidas, medidor de fuerza y checklist en vivo.
- Pantalla de movimientos con tabla, alta/edición en diálogo y borrado con
  confirmación.
- Mensajería en español.

---

## Leyenda de estado
- ✅ Completada · 🔄 En curso · ⏭️ Siguiente · ⏳ Pendiente
