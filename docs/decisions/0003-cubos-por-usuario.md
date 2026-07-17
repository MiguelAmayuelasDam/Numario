# ADR-0003 — El cubo del 50-30-20 debe poder decidirlo el usuario

- **Estado:** aceptada · **implementación aplazada** (fuera del alcance de la v1)
- **Fecha:** 2026-07-17
- **Contexto:** Fase 7. Detectado al contrastar Numario con el sistema real
  (una hoja de Excel de dos años) que usaba el autor antes de construirlo.

---

## Contexto

Hoy el cubo del 50-30-20 es una **propiedad de la categoría**: `Category.bucket`
vale `living`, `monthly` o `investment`, viene fijado en la migración `0004` y es
**global para todos los usuarios**. "Supermercado" es Vida para todo el mundo;
"Restaurante" es Mes para todo el mundo. El usuario puede cambiar los
**porcentajes** (50/30/20 → 60/20/20) pero no **qué cae en cada cubo**.

Para validar si ese modelo aguanta, se cruzaron las **45 categorías** de la hoja
de Excel con la que el autor gestionaba sus finanzas contra los cubos que Numario
asigna por defecto.

## El hallazgo

**11 de 45 categorías (~25%) caen en un cubo distinto al que su dueño les daría.**

| Categoría del autor | Su cubo | Numario | Cubo de Numario |
| --- | --- | --- | --- |
| Gimnasio | Vida | `Deporte` | Mes |
| Tecnología | Vida | `Electrónica` | Mes |
| Peluquero | Vida | `Belleza` | Mes |
| Deuda personal | Vida | `Préstamos` | Inversión |
| Deuda tarjeta de crédito | Vida | `Préstamos` | Inversión |
| Formación | Mes | `Estudios` | Vida |
| Gastos vehículo | Mes | `Mantenimiento vehículo` | Vida |
| Vacaciones vuelo | Mes | `Transportes` | Vida |
| Bizum | Mes | `Traspasos y transferencias` | No computable |
| Pérdidas inversión | Mes | — | **no existe** |
| Comisiones inversión | Mes | `Inversiones` | Inversión |

Lo importante: **ninguna es un error de Numario**. Que el gimnasio sea capricho o
necesidad depende de si te lo puedes quitar; que amortizar la tarjeta sea Vida o
Inversión depende de si lo vives como una factura o como construir patrimonio.
**No hay respuesta correcta: hay la respuesta de cada uno.** Y ningún conjunto de
defaults "mejor" lo arregla, porque el siguiente usuario tendrá otras once.

## El análisis: no es un problema, son tres

### 1. El cubo es constante, pero no el que el usuario quiere
`Peluquero → Vida`, `Préstamos → Vida`. Para ese usuario es **siempre** así.
Cubre ~8 de los 11 casos.

### 2. La intención cambia en cada movimiento
Un móvil **que necesitas** es Vida; el mismo móvil **por capricho** es Mes. Y
aquí está el límite duro:

> Para el banco, los dos son `MEDIAMARKT 300€`.

No hay categoría, default ni motor de reglas que los distinga — **ni un modelo de
IA lo sabría**, porque la diferencia solo existe en la cabeza de quien compró. Es
información que **no está en el dato**.

### 3. Falta una categoría (y esto no va de cubos)
Existe `Rendimientos` para las ganancias de inversión, pero **no hay nada para
las pérdidas**: el catálogo asume implícitamente que las inversiones solo suben.
Es una asimetría del catálogo, no un problema de cubos.

> **Un caso que parecía del grupo 2 y no lo era.** "El gimnasio es Vida pero ir a
> los bolos es ocio" se resuelve con las categorías que ya existen: el gimnasio
> es `Deporte` (que pasaría a Vida) y los bolos son `Otros ocio` (que ya es Mes).
> No es un gasto con dos intenciones: son dos gastos distintos. Cae en el
> grupo 1.

## Decisión

**No se rediseña el modelo.** Que la categoría lleve un cubo es correcto: es un
default excelente y es lo que permite que la clasificación automática funcione.
Lo que está mal es que la asignación esté **congelada**.

Se adoptan tres cambios, **independientes entre sí**:

1. **Cubo editable por categoría, por usuario.** Los cubos actuales siguen siendo
   el default; el usuario los adapta a su vida.
2. **Override de cubo por movimiento**, como *escotilla*: campo **opcional**, con
   el default heredado de la categoría. Solo se toca en la excepción.
3. **Categoría "Pérdidas y comisiones de inversión"** (gasto, cubo Inversión).
   Aglutinada: para una brújula del 50-30-20 no hace falta separarlas.

### Por qué 1 **y** 2, y no uno solo

- **Solo el 1** no cubre el caso del móvil: misma categoría, dos intenciones.
- **Solo el 2** obligaría a corregir el peluquero **todos los meses**: convierte
  una decisión que se toma una vez en un peaje permanente.
- **Juntos**: la categoría pone el default personal y el movimiento resuelve la
  excepción. Trabajo cero en el ~95% de los casos y fidelidad total cuando hace
  falta.

Ese equilibrio es el que respeta las dos promesas del producto a la vez: que los
datos sean **fieles a la realidad** y que la aplicación **no pida trabajo** — que
es exactamente por lo que se abandonan estas apps (ver
[`docs/analysis/01-personas.md`](../analysis/01-personas.md)).

### Por qué esto es coherente y lo actual no

Ya se aceptó que **el 50-30-20 es una regla personal** cuando se hicieron los
porcentajes configurables (Fase 5). Pero se dejó hardcodeada la parte **más**
personal: qué cuenta como necesidad. Y es la que más pesa — los porcentajes se
tocan una vez; el cubo de "Gimnasio" afecta a **cada movimiento, todos los
meses**.

## Diseño de la solución

**No tocar `Category.bucket`.** Las categorías semilla son globales
(`user_id IS NULL`) y **compartidas**: cambiar el cubo de "Supermercado" se lo
cambiaría a todos los usuarios.

```
category_bucket_override
  user_id      uuid  FK users     ─┐ PK compuesta
  category_id  uuid  FK categories─┘
  bucket       enum  (living | monthly | investment)
```

- **Resolución**: `bucket = override(user, category) ?? category.bucket`, en
  `analytics_service` y allá donde hoy se lee `category.bucket`.
- **Override por movimiento**: columna `bucket` *nullable* en `transaction`;
  `NULL` = heredar de la categoría. Nunca se rellena automáticamente.
- **Orden de precedencia**: `transaction.bucket` → override de categoría →
  `category.bucket`.

### Efecto retroactivo (hay que saberlo)

Cambiar el cubo de una categoría **reescribe la forma del historial**: si
`Deporte` pasa a Vida, todos los gimnasios pasados cambian de cubo y el análisis
de meses cerrados se recalcula. **Es el comportamiento correcto** —el 50-30-20 se
calcula, no se congela— pero es visible y conviene avisar al usuario en la UI.
Añadir categorías, en cambio, es aditivo y no afecta a nada existente.

## Por qué se aplaza

Detectado el **17/07/2026**, con la entrega el **20/07** y la aplicación ya en
producción. Los tres cambios tocan **el cálculo del dinero** (`analytics_service`),
requieren migración y afectan a datos reales.

Meter una migración sobre el núcleo financiero a tres días de la entrega, con un
despliegue estable y el vídeo sin grabar, es un riesgo que **no compensa**: el
coste de equivocarse (analítica mal en producción) supera con mucho al de
convivir con una imprecisión que el usuario ya conoce y que no cambia ninguna
decisión suya.

Entra en el backlog **inmediatamente después de la entrega**, en el orden
3 → 1 → 2 (de menor a mayor riesgo: el 3 es aditivo y no toca el cálculo).

## Alternativas descartadas

| Alternativa | Por qué no |
| --- | --- |
| **No cambiar nada** | Deja el 25% de las categorías del usuario en un cubo que él considera equivocado. No es imprecisión de céntimos: es que el semáforo mide otra cosa. |
| **Desdoblar categorías por intención** ("Electrónica necesaria" / "Electrónica capricho") | La clasificación automática **no puede distinguirlas** (ambas son `MEDIAMARKT`), así que caerían siempre en la misma. Además dispara el catálogo y da dos sitios donde puede caer lo mismo, que ensucia los datos. |
| **Mejorar los defaults** | No hay defaults correctos. El desacuerdo no es un error: es una diferencia de vidas. |
| **Solo override por movimiento** | Funciona, pero cobra un peaje eterno por decisiones que son constantes. |
| **Categorías de propósito** (como el Excel: "Comida" en vez de "Supermercado") | Matan la clasificación automática: un motor de reglas puede leer el comercio del extracto, jamás la intención. Es el intercambio que ya se aceptó al elegir automatización. |

## Consecuencias

**A favor**
- El 50-30-20 pasa a ser **de verdad** la regla del usuario, no la de Numario.
- Los datos se vuelven fieles a la realidad sin pedir más trabajo.
- Se cierra la asimetría de ganancias/pérdidas del catálogo.

**En contra**
- Una tabla y una resolución más en el camino caliente de la analítica.
- El override por movimiento es un campo más en la UI: hay que esconderlo bien
  (plegado, no en el flujo principal) o traiciona el "no me pidas trabajo".
- Cambiar cubos reescribe la forma del historial: hay que comunicarlo.

## Relacionado

- [ADR-0001 — Stack tecnológico](0001-stack-tecnologico.md)
- [`docs/architecture/01-modelo-datos.md`](../architecture/01-modelo-datos.md) — modelo ER actual
- Fase 5 en [`docs/glosario-funcionalidades.md`](../glosario-funcionalidades.md) — porcentajes configurables
