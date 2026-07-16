# OWASP Top 10 (2021) — Mapeo de mitigaciones

Revisión transversal de la aplicación frente al **OWASP Top 10:2021**, con las
mitigaciones ya implementadas y los huecos pendientes. Complementa a
[`01-owasp-autenticacion.md`](01-owasp-autenticacion.md) (detalle de auth).

Estado por categoría: ✅ cubierto · 🟡 parcial · ⏳ pendiente.

---

## A01 — Broken Access Control ✅
- **Aislamiento por usuario**: todos los recursos (movimientos, categorías,
  presupuesto, ingresos mensuales, previsto, colchón) se filtran por `user_id`
  del token; nunca se confía en un id de la petición para saltar de usuario.
- **Claves primarias UUID** para evitar enumeración de recursos (regla §7.7).
- **Rutas protegidas** con `Depends(get_current_user)`; el frontend además guarda
  las páginas privadas con `ProtectedRoute`.
- Cambios de perfil (`PATCH /auth/me`) solo afectan al usuario autenticado.

## A02 — Cryptographic Failures ✅
- Contraseñas con **argon2id** (`pwdlib`), nunca en claro.
- **JWT HS256** con secreto por entorno; refresh tokens **opacos** almacenados
  como **sha256** (no se guarda el token en claro), rotables y revocables.
- Importes con `Decimal`/`NUMERIC` (integridad del dato, no cripto, pero evita
  pérdidas de precisión).
- 🟡 **TLS**: responsabilidad del despliegue (Vercel/Render dan HTTPS); se envía
  `Strict-Transport-Security`.

## A03 — Injection ✅
- **SQLAlchemy 2.0** con consultas parametrizadas (sin SQL string-building).
- **Validación de entrada con Pydantic** en todos los endpoints (tipos, longitudes,
  rangos, patrón de nick, tope de importes).
- Salida JSON serializada por Pydantic; el frontend (React) escapa por defecto.

## A04 — Insecure Design 🟡
- **Rate limiting** en login (`slowapi`), **política de contraseña** robusta,
  **deduplicación** en la importación y **tope de importes** (9.999.999) en todos
  los puntos de entrada de dinero (incluida la importación CSV).
- Verificación en **tiempo constante** para no filtrar si un usuario existe.
- ⏳ Pendiente: modelado de amenazas más formal y límites de negocio adicionales.

## A05 — Security Misconfiguration ✅
- **Secretos solo por variables de entorno** (nunca en el repo); `.env.example`
  sin valores reales.
- **CORS restringido** a orígenes configurados (`settings.cors_origins_list`).
- **Cabeceras de seguridad** en todas las respuestas: `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Strict-Transport-Security`.
- Rate limit **relajado solo en el entorno Docker/E2E**; en producción se fija por
  entorno.
- **Guarda de arranque**: la aplicación **se niega a arrancar** si
  `ENVIRONMENT=production` con el secreto JWT de desarrollo
  (`_no_dev_secrets_in_production` en `app/core/config.py`). Un despliegue mal
  configurado falla de forma ruidosa en vez de quedarse firmando tokens con un
  secreto que está publicado en el repositorio.

### Decisión consciente: `/docs` y `/openapi.json` son públicos

La documentación interactiva (Swagger UI) **se deja accesible sin autenticación**
en producción. Es *information disclosure* y conviene declararlo, no que parezca
un descuido:

- **Qué expone**: la forma de la API (rutas, esquemas, códigos de error). **No**
  expone datos: todos los endpoints de dominio siguen exigiendo JWT
  (`GET /api/v1/categories` sin token → `401`), y el aislamiento por usuario de
  A01 sigue vigente.
- **Por qué se acepta**: Numario es un **proyecto de portfolio y de defensa
  académica**; que el corrector pueda explorar el contrato de la API sin
  credenciales es parte del objetivo del proyecto. El valor de la transparencia
  supera aquí al de la ocultación.
- **Por qué no es "seguridad" perderla**: ocultar `/docs` sería *security through
  obscurity*. La API no está protegida porque su forma sea secreta, sino por
  autenticación, autorización y rate limiting.
- **Cuándo habría que cerrarlo**: si la aplicación pasara a un uso real con datos
  de terceros. La mitigación es de una línea: `FastAPI(docs_url=None,
  redoc_url=None, openapi_url=None)` cuando `settings.environment == "production"`.

> Endpoint raíz `GET /` : devuelve solo nombre, versión y enlaces a `/docs` y
> `/health`. No revela nada que `/docs` no revele ya.

## A06 — Vulnerable and Outdated Components ✅
- **Escaneo de dependencias en CI**: `pip-audit` (Python) y `npm audit`
  (`--audit-level=high`, frontend). Estado actual: **0 vulnerabilidades**.
- Dependencias fijadas con `uv.lock` / `package-lock.json`.

## A07 — Identification and Authentication Failures ✅
- Login por email **o** nick; **rate limiting** para frenar fuerza bruta.
- Refresh tokens rotables y revocables; logout que invalida el refresh.
- Política de contraseña + bloqueo de contraseñas comunes.
- Detalle completo en [`01-owasp-autenticacion.md`](01-owasp-autenticacion.md).

## A08 — Software and Data Integrity Failures 🟡
- Lockfiles para dependencias reproducibles; CI con lint, tipos, tests y escaneo.
- ⏳ Pendiente: firma/verificación de artefactos de despliegue (fuera del alcance
  del proyecto).

## A09 — Security Logging and Monitoring Failures 🟡
- `/health` para readiness; errores con formato consistente y códigos HTTP
  adecuados.
- ⏳ Pendiente: logging estructurado de eventos de seguridad (logins fallidos,
  429) y alertas — mejora futura.

## A10 — Server-Side Request Forgery (SSRF) ✅
- La API **no realiza peticiones a URLs proporcionadas por el usuario** (la capa
  de IA está apagada, `ai_provider="none"`), por lo que la superficie de SSRF es
  nula en la v1.

---

## Endurecimientos adicionales (Fase 6)
- **Límite de tamaño de subida CSV** (2 MiB) → evita agotar memoria (DoS).
- **Cabeceras de seguridad** (ver A05).
- **Escaneo de seguridad en CI** (Bandit + pip-audit + npm audit).
- Bandit: 0 issues (la única alerta, `B110` en la mitigación de timing, está
  documentada con `# nosec`).

## Huecos priorizados (backlog)
1. Logging estructurado de eventos de seguridad (A09).
2. Modelado de amenazas formal y límites de negocio (A04).
