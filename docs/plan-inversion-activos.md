# Plan de trabajo — Cartera de inversión por activo

> Funcionalidad nueva, en la rama `feat/inversion-activos`. Experimental / de uso
> personal por ahora; si cuaja, se integra a `main` por PR. Los **datos** reales
> (Excel de `amayu`) **nunca** entran aquí: van a la base de datos local y el
> fichero queda en `.gitignore`.

---

## 1. Qué resuelve

Hoy toda la inversión cae en un único cubo ("Inversión", el 20% del 50-30-20),
alimentado por traspasos a la categoría "Inversiones". Esta funcionalidad
**rompe ese cubo en una cartera de activos** y añade tres cosas:

1. **Definir activos** (ETFs, fondos, acciones, cripto, renta fija) con un
   **peso objetivo**.
2. **Calcular el reparto**: le dices cuánto vas a invertir este mes y la app te
   dice la **cantidad exacta por activo**.
3. **Marcar cada aportación como hecha** ✓, lo que **crea el movimiento** real.

**Fuera de alcance a propósito** (decidido con el autor): la rentabilidad y el
valor de mercado. Eso se sigue en Interactive Brokers, no en Numario. Aquí no
hay cotizaciones, ni valoraciones, ni cálculo de rendimiento.

## 2. El modelo mental (dos niveles)

```
Total del mes: 1.000 €
├─ Renta variable  70%  → 700 €
│    ├─ ETF World   60%  → 420 €   (60% de 700)
│    └─ ETF S&P     40%  → 280 €   (40% de 700)
└─ Renta fija      30%  → 300 €
     └─ Fondo RF   100%  → 300 €
```

- Los pesos de **clase** (variable / fija) suman 100.
- Dentro de cada clase, los pesos de los **activos** suman 100.
- El importe calculado es una **sugerencia editable**: si un mes metes un extra
  en un activo, ajustas la cantidad al marcarlo (no está atado al %).

## 3. Modelo de datos

**`asset`** (tabla nueva)
| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | FK `users` · `ON DELETE CASCADE` |
| `name` | str | "ETF MSCI World" |
| `asset_class` | enum | `variable` \| `fija` |
| `kind` | enum | `etf` \| `fondo` \| `accion` \| `cripto` \| `otro` |
| `weight` | NUMERIC | peso **dentro de su clase** (los de una clase suman 100) |
| `active` | bool | archivar sin borrar el histórico |
| `sort_order` | int | orden en la pantalla |

**`investment_allocation`** (tabla nueva, una fila por usuario)
| Campo | Tipo | Notas |
| --- | --- | --- |
| `user_id` | uuid | PK · FK `users` cascade |
| `variable_pct` | int | peso de renta variable |
| `fixed_pct` | int | peso de renta fija (variable+fija = 100) |

**`transaction.asset_id`** (columna nueva, *nullable* FK a `asset`)
Enlaza un movimiento con su activo. Los movimientos normales lo llevan a `NULL`.
Es lo que hace que "es un movimiento con activo" sea **una sola fuente de
verdad**: una aportación es un traspaso a "Inversiones" (que ya alimenta el cubo
Inversión) con el activo apuntado. El 50-30-20 sigue cuadrando **sin tocar
`analytics_service`**.

> Migración **0012** (la última es 0011). Puede ir todo junto o partirse en
> 0012 (asset) + 0013 (columna + allocation); se decide al implementar.

## 4. La lógica delicada: el reparto que cuadra al céntimo

`compute_plan(total, allocation, assets)` → euros por activo.

El único trozo con riesgo real es el **redondeo**: `1.000 €` repartido en
porcentajes con decimales tiene que sumar **exactamente 1.000**, ni un céntimo de
más ni de menos. Ejemplo tramposo: tres activos al 33,33% dan 999,99 €.

- Se calcula con `Decimal`, nunca `float` (regla §7.1 del proyecto).
- El céntimo sobrante se asigna por **mayor resto** (largest-remainder), de forma
  determinista.
- **TDD obligatorio** aquí (regla §7.3: lógica financiera). El test se escribe
  antes: casos con decimales feos, un solo activo, una clase vacía, total 0.

## 5. Fases

### Fase A — Modelo y migración
- Modelos `Asset` e `InvestmentAllocation`; columna `asset_id` en `Transaction`.
- Migración 0012.
- Sin lógica todavía. **Hito:** `alembic upgrade head` y la BD tiene las tablas.

### Fase B — Servicio del reparto (TDD)
- `investment_service.compute_plan(...)`, con los tests **primero**.
- `compute_plan` no sabe nada de HTTP ni de la BD: recibe datos, devuelve el
  reparto. Se prueba sin levantar servidor (capa `services`, §arquitectura).
- **Hito:** el reparto cuadra al céntimo en todos los casos límite.

### Fase C — API
- `asset`: CRUD (crear, listar, editar peso, archivar).
- `investment-allocation`: GET / PUT (el split variable/fija, debe sumar 100).
- `investment/plan?total=X`: devuelve el reparto calculado (no persiste nada).
- `investment/contribution`: marca un activo como aportado → **crea la
  transacción** (traspaso · categoría Inversiones · cubo Inversión · `asset_id`).
- `investment/month?year&month`: estado del mes (qué activos ya están hechos).
- Tests de cada endpoint + aislamiento por usuario (§7).
- **Hito:** el flujo completo funciona por API (curl).

### Fase D — Frontend
- Pantalla **Cartera** en el menú:
  - gestión de activos (alta, clase, tipo, peso) y del split variable/fija;
  - **calculadora**: metes el total → ves los euros por activo;
  - **checklist del mes**: cada activo con su importe y su check "hecho";
  - marcar hecho crea el movimiento (importe editable para los extras).
- El detalle de un movimiento muestra su activo, si lo tiene.
- Tests con Vitest + un E2E del camino feliz (definir activo → calcular →
  marcar → verlo en movimientos).
- **Hito:** se puede planificar y registrar el mes desde la interfaz.

### Fase E — Integración y cierre
- Verificar que el **cubo Inversión sigue cuadrando** (las aportaciones lo
  alimentan y no se cuenta dos veces).
- Semilla opcional: dar a `mouredev` un par de activos para que la pantalla no
  salga vacía en la demo.
- Actualizar `docs/glosario-funcionalidades.md` y `docs/comandos.md` (§8).
- **Hito:** feature completa, tests en verde, lista para PR si se decide.

## 6. Lo que NO se toca

- **`analytics_service` ni el 50-30-20.** El diseño con `asset_id` en la
  transacción hace que el cubo Inversión funcione igual sin cambiar la analítica.
- **La rentabilidad / valoraciones.** Fuera de alcance por decisión del autor.
- **`main`.** Todo vive en esta rama hasta que se decida el PR.

## 7. Riesgos y cómo se mitigan

| Riesgo | Mitigación |
| --- | --- |
| El reparto no cuadra al céntimo | `Decimal` + mayor resto + TDD antes del código |
| Contar la inversión dos veces | Una aportación **es** el movimiento (`asset_id`), no un registro paralelo |
| Romper el cubo Inversión | No se toca la analítica; se verifica en la Fase E |
| Perder la rama (solo en local) | `git push -u origin feat/inversion-activos` como copia de seguridad |
