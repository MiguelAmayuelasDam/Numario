# Contrato de la API REST

Borrador del contrato. La implementación real generará la documentación
Swagger/OpenAPI automáticamente vía FastAPI. Prefijo base: `/api/v1`.

Todos los endpoints salvo autenticación requieren cabecera
`Authorization: Bearer <access_token>`.

---

## Auth

| Método | Ruta                | Descripción                         | Auth |
| ------ | ------------------- | ----------------------------------- | ---- |
| POST   | `/auth/register`    | Registrar usuario                   | No   |
| POST   | `/auth/login`       | Login, devuelve access + refresh    | No   |
| POST   | `/auth/refresh`     | Renovar access token (rotación)     | No*  |
| POST   | `/auth/logout`      | Invalidar refresh token             | Sí   |
| GET    | `/auth/me`          | Datos del usuario autenticado       | Sí   |

\* requiere refresh token válido.

**POST /auth/register**
```json
// request
{ "email": "user@mail.com", "nickname": "miusuario", "password": "••••••••" }
// response 201
{ "id": "uuid", "email": "user@mail.com", "nickname": "miusuario" }
```

Reglas:
- `nickname`: obligatorio y **único** (3–30). Admite letras (incl. tildes, ñ, ü…),
  números y `. _ -`, sin espacios. Se normaliza a minúsculas, igual que el email.
- `password`: ≥ 8 con mayúscula, minúscula, número y símbolo; no puede ser una
  contraseña común ni contener el email o el nick. Fallo → `422` con la lista de
  requisitos incumplidos.
- Email o nick duplicado → `409`.

**POST /auth/login**
```json
// request — el identificador puede ser el email o el nick
{ "identifier": "user@mail.com", "password": "••••••••" }
// response 200
{ "access_token": "jwt", "refresh_token": "opaco", "token_type": "bearer" }
```

**POST /auth/refresh** · **POST /auth/logout**
```json
// request (ambos)
{ "refresh_token": "opaco" }
```
El refresh **rota**: cada renovación revoca el token usado y emite uno nuevo
(reutilizar uno ya rotado → `401`). El logout revoca el refresh indicado.

**GET /auth/me** → `200 { "id", "email", "nickname" }` (requiere Bearer).

---

## Transactions

| Método | Ruta                     | Descripción                          |
| ------ | ------------------------ | ------------------------------------ |
| GET    | `/transactions`          | Listar (ordenado, filtros opcionales)|
| POST   | `/transactions`          | Crear movimiento manual              |
| GET    | `/transactions/{id}`     | Detalle                              |
| PATCH  | `/transactions/{id}`     | Editar                               |
| DELETE | `/transactions/{id}`     | Eliminar                             |
| POST   | `/transactions/{id}/split` | Dividir en varias categorías       |

Query params de listado: `from`, `to`, `category_id`, `type`, `page`, `size`.
El listado va **ordenado de más reciente a más antiguo** (`occurred_on` desc).

**POST /transactions** (request)
```json
{
  "amount": "42.90",
  "type": "expense",
  "concept": "Mercadona",
  "occurred_on": "2026-07-03",
  "category_id": "uuid"   // opcional; puede quedar sin categoría
}
```
Reglas: `amount` > 0 como **string decimal** (2 decimales; se cuantiza en el
servidor). `type` ∈ {`income`, `expense`, `transfer`} (`transfer` = **No
computable**: traspaso, ni gasto ni ingreso). `category_id` debe ser global o
del usuario (si no, `422`).

**Respuesta 201 / 200** (incluye la categoría anidada y el origen)
```json
{
  "id": "uuid",
  "amount": "42.90",
  "type": "expense",
  "concept": "Mercadona",
  "occurred_on": "2026-07-03",
  "category_id": "uuid",
  "category": { "id": "uuid", "name": "Supermercado", "bucket": "living", "emoji": "🛒", "is_default": true },
  "source": "manual",
  "created_at": "2026-07-03T10:00:00Z"
}
```

**POST /transactions/{id}/split** — divide un movimiento en varias partes por
categoría (p. ej. un Bizum de 7 € = 5 € comida + 2 € gasolina).
```json
// request (al menos 2 partes; heredan tipo, concepto y fecha del original)
{ "parts": [ { "amount": "5.00", "category_id": "uuid" },
             { "amount": "2.00", "category_id": "uuid" } ] }
// response 201 → lista de los movimientos creados (el original se elimina)
```
La suma de las partes debe coincidir **exactamente** con el importe original; si
no, `422` con el detalle (`Las partes deben sumar X € (suman Y €)`).

---

## Categories

| Método | Ruta                  | Descripción                 |
| ------ | --------------------- | --------------------------- |
| GET    | `/categories`         | Listar (incluye por defecto)|
| POST   | `/categories`         | Crear categoría propia      |
| PATCH  | `/categories/{id}`    | Editar                      |
| DELETE | `/categories/{id}`    | Eliminar (solo propias)     |

---

## Import

| Método | Ruta                | Descripción                                   |
| ------ | ------------------- | --------------------------------------------- |
| POST   | `/import/preview`   | Subir CSV, devolver filas parseadas + clasif. |
| POST   | `/import/confirm`   | Persistir los movimientos previsualizados     |

Formato de CSV soportado: **extracto imagin/CaixaBank** (separador `;`, importe
español `-6,40EUR`, fecha `dd/mm/yyyy`; se ignoran las líneas de metadatos). El
**signo** decide gasto/ingreso; los traspasos → `transfer` (no computable).

**POST /import/preview** (multipart/form-data, campo `file`)
```json
// response 200 — no persiste nada; solo previsualiza
{
  "rows": [
    {
      "concept": "MERCADONA JULIAN", "occurred_on": "2026-06-24",
      "amount": "13.18", "type": "expense",
      "suggested_category_id": "uuid",
      "category": { "id": "uuid", "name": "Supermercado", "bucket": "living", "emoji": "🛒", "is_default": true },
      "source": "rule",          // "learned" | "rule" | null
      "duplicate": false          // ya existe un movimiento idéntico
    }
  ],
  "summary": { "total": 120, "classified": 98, "needs_review": 22, "duplicates": 3, "errors": 0 },
  "error_details": ["Línea 45: Fila inválida: ..."]
}
```
Clasificación **sin IA de pago**: reglas semilla (comercios) + reglas aprendidas
de las correcciones del usuario (`classification_rule`).

**POST /import/confirm**
```json
// request — solo las filas que el usuario confirma (con su categoría, opcional)
{ "items": [ { "amount": "13.18", "type": "expense", "concept": "MERCADONA JULIAN",
               "occurred_on": "2026-06-24", "category_id": "uuid" } ] }
// response 201
{ "created": 1 }
```
Al confirmar, si el usuario cambia la categoría respecto a la sugerencia, el
sistema **aprende** una regla (keyword → categoría) para futuras importaciones.

---

## Budget

| Método | Ruta         | Descripción                                    |
| ------ | ------------ | ---------------------------------------------- |
| GET    | `/budget`    | Configuración 50-30-20 (o defaults si no hay)  |
| PUT    | `/budget`    | Actualizar ingreso mensual y porcentajes       |

```json
// GET/PUT /budget — los 3 porcentajes son CONFIGURABLES y deben sumar 100
{ "monthly_income": "2000.00", "living_pct": 50, "monthly_pct": 30, "investment_pct": 20 }
```

---

## Analytics

Regla: los movimientos **No computables** (`type = transfer`) **no cuentan** en
ingresos, gastos, neto ni cubos.

| Método | Ruta                    | Descripción                                     |
| ------ | ----------------------- | ----------------------------------------------- |
| GET    | `/analytics/overview`   | Resumen + cubos 50-30-20 + gasto por categoría  |
| GET    | `/analytics/series`     | Serie ingresos/gastos por mes/año (navegador)   |

Query params: `granularity=month\|year`, `year`, `month` (overview) · `count` (series).

**GET /analytics/overview?granularity=month&year=2026&month=7**
```json
{
  "period_label": "julio 2026",
  "date_from": "2026-07-01", "date_to": "2026-07-31",
  "summary": { "income": "2000.00", "expense": "1360.00", "net": "640.00" },
  "buckets": [
    { "bucket": "living",     "label": "Vida",      "budget": "1000.00", "spent": "820.00", "pct": 82, "status": "warning" },
    { "bucket": "monthly",    "label": "Mes",       "budget": "600.00",  "spent": "540.00", "pct": 90, "status": "warning" },
    { "bucket": "investment", "label": "Inversión", "budget": "400.00",  "spent": "0.00",   "pct": 0,  "status": "ok" }
  ],
  "categories": [ { "category_id": "uuid", "name": "Supermercado", "emoji": "🛒", "bucket": "living", "spent": "420.00" } ]
}
```
`status`: `ok` (<80%) · `warning` (80–100%) · `over` (>100%) para el semáforo.

## Convenciones

- Importes como **string decimal** en JSON para evitar pérdida de precisión.
- Fechas en ISO-8601 (`YYYY-MM-DD`).
- Errores con formato consistente: `{ "detail": "mensaje" }` y código HTTP
  adecuado (400, 401, 403, 404, 422).
