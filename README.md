# Numario — Gestor de Finanzas Personales

> Aplicación web que ayuda a tomarse en serio el dinero y las finanzas personales sin abandonar por pereza
> ni aburrimiento, repartiendo el ingreso con la regla **50-30-20** y siguiendo
> el progreso del **colchón de emergencia**.

Proyecto final del Máster de Desarrollo de Software con IA.

---

## Enlaces del proyecto

| | |
| --- | --- |
| 🌐 **Aplicación desplegada** | **<https://numario.vercel.app>** |
| 📊 **Presentación (slides)** | <!-- SLIDES --> `⚠️ pendiente — pegar URL aquí` |
| 🎬 **Vídeo de presentación** | <!-- VIDEO --> `⚠️ pendiente — pegar URL aquí` |
| 💻 **Código fuente** | <https://github.com/MiguelAmayuelasDam/Numario> |

> Para entrar en la aplicación, usa las credenciales de prueba del final:
> [Usuario y contraseña de prueba](#usuario-y-contraseña-de-prueba).

---

## Índice

- [Numario — Gestor de Finanzas Personales](#numario--gestor-de-finanzas-personales)
  - [Enlaces del proyecto](#enlaces-del-proyecto)
  - [Índice](#índice)
  - [Descripción general](#descripción-general)
  - [Stack tecnológico](#stack-tecnológico)
  - [Instalación y ejecución](#instalación-y-ejecución)
    - [Comandos útiles](#comandos-útiles)
  - [Estructura del proyecto](#estructura-del-proyecto)
    - [Cómo se comunica todo](#cómo-se-comunica-todo)
  - [Funcionalidades principales](#funcionalidades-principales)
  - [Usuario y contraseña de prueba](#usuario-y-contraseña-de-prueba)

---

## Descripción general

**El problema.** A casi todo el mundo le preocupa gastar de más. El problema no
es la falta de intención: es que **en cuanto te olvidas, gastas sin control**. Y
las herramientas que existen para evitarlo suelen exigir tanta disciplina —
apuntarlo todo, categorizar a mano, revisar tablas — que se acaban abandonando
por pereza o aburrimiento. El resultado es el mismo que si no existieran.

**La propuesta.** Numario ataca ese olvido con **visibilidad continua**: en vez de
pedirte trabajo, te responde de un vistazo a la única pregunta que importa —
*"¿estoy ahorrando o despilfarrando este mes?"*. Dos ideas lo vertebran:

- **La regla 50-30-20.** El ingreso de cada mes se reparte en tres cubos:
  **Vida** (50%) para lo que no puedes evitar — vivienda, comida, suministros;
  **Mes** (30%) para lo que decides — ocio, ropa, caprichos; e **Inversión**
  (20%) para lo que te queda. Cada cubo tiene un semáforo, así que ves si te
  estás pasando **antes** de que acabe el mes, no después.
- **El colchón de emergencia.** Un objetivo de entre 3 y 6 meses de tus gastos de
  vida, con su progreso y sus aportaciones. Es la red que convierte un imprevisto
  en una molestia en vez de en un problema.

Para que mantenerlo al día no sea el trabajo que te haga abandonar, los
movimientos se importan del extracto del banco en CSV y **se clasifican solos**;
cuando corriges una categoría, Numario **aprende** y no vuelve a fallar en ese
comercio.

## Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| **Frontend** | React 19 · TypeScript · Vite 6 · Tailwind CSS v4 · shadcn/ui |
| **Backend** | FastAPI (Python 3.13) · dependencias con `uv` |
| **Base de datos** | PostgreSQL 16 · SQLAlchemy 2.0 · Alembic |
| **Autenticación** | JWT (access + refresh rotables) · hash argon2id (`pwdlib`) |
| **Clasificación** | Motor de reglas propio + aprendizaje (**sin IA externa**) |
| **Testing** | pytest · Vitest · Playwright |
| **Contenerización** | Docker · Docker Compose |
| **CI/CD** | GitHub Actions |
| **Despliegue** | Vercel (frontend) · Render (backend) · Neon (PostgreSQL) |

**Sobre la clasificación y la IA.** El diseño original contemplaba llamar a un
modelo (OpenAI/Gemini) para categorizar los movimientos. **Se descartó tras
comprobar que no hacía falta**: el dominio son comercios españoles recurrentes
—Mercadona, Repsol, Netflix—, un problema que un diccionario de reglas resuelve
con más precisión, coste cero, sin latencia, sin depender de un tercero y sin
enviar los datos financieros del usuario a una API ajena. La capa de IA queda
como **punto de extensión documentado** (`ai_provider="none"` en la
configuración), pero **no se invoca**: lo que hay en el código es un motor de
reglas de dos capas que aprende de las correcciones. Se ha preferido decirlo aquí
antes que dejar en el stack una tecnología que no se usa.

**Sobre el dinero.** Todos los importes usan `Decimal`/`NUMERIC` — nunca `float`
— y viajan como *string* en el JSON. Con dinero, un error de redondeo del
coma-flotante no es un detalle: es un saldo mal.

## Instalación y ejecución

**Único requisito: Docker** (con Compose v2). No necesitas instalar Python, Node
ni PostgreSQL.

```bash
git clone https://github.com/MiguelAmayuelasDam/Numario.git
cd Numario
cp .env.example .env          # los valores por defecto sirven para local
docker compose up --build     # levanta postgres + backend + frontend
```

Y ya está. Cuando termine:

| | |
| --- | --- |
| **Aplicación** | http://localhost:5173 |
| **API (Swagger)** | http://localhost:8000/docs |
| **Health check** | http://localhost:8000/health → `{"status":"ok","db":"ok"}` |

Las **migraciones se aplican solas** al arrancar el backend: no hay que ejecutar
nada a mano ni cargar ningún `.sql`. La base de datos queda lista con sus 79
categorías semilla.

Para trabajar sin Docker sobre un servicio concreto, cada carpeta tiene su guía:
[`backend/README.md`](backend/README.md) (uv, migraciones, tests) y
[`frontend/README.md`](frontend/README.md) (npm, Vite, tests). El runbook con
todos los comandos —tests, cobertura, E2E, seguridad— está en
[`docs/comandos.md`](docs/comandos.md).

### Comandos útiles

```bash
docker compose logs -f backend    # seguir los logs
docker compose down               # parar
docker compose down -v            # parar y borrar los datos (empezar de cero)
```

## Estructura del proyecto

```
Numario/
├── backend/                  # API REST (FastAPI)
│   ├── app/
│   │   ├── api/v1/           # endpoints: auth · transactions · categories
│   │   │                     #   analytics · budget · emergency_fund
│   │   │                     #   forecast · imports
│   │   ├── core/             # configuración, seguridad, rate limiting
│   │   ├── db/               # sesión de SQLAlchemy
│   │   ├── models/           # tablas
│   │   ├── schemas/          # validación y serialización (Pydantic)
│   │   └── services/         # lógica de negocio
│   ├── alembic/versions/     # 11 migraciones
│   ├── scripts/              # seed del usuario de demostración
│   ├── tests/                # 128 tests (pytest)
│   └── Dockerfile
├── frontend/                 # Aplicación web (React)
│   ├── src/
│   │   ├── components/       # UI reutilizable (shadcn/ui + propios)
│   │   ├── context/          # sesión y tema
│   │   ├── lib/              # cliente de la API, validación, utilidades
│   │   └── pages/            # una por pantalla, con sus tests al lado
│   ├── e2e/                  # 7 specs (Playwright)
│   └── Dockerfile
├── docs/                     # análisis · arquitectura · decisiones · seguridad
├── .github/workflows/        # CI: backend · frontend · E2E · seguridad
├── compose.yaml              # postgres + backend + frontend
├── .env.example              # plantilla de variables (sin secretos)
└── CLAUDE.md                 # memoria del proyecto y guía de desarrollo
```

### Cómo se comunica todo

```
        Navegador
            │
            ▼
    Frontend (React)                        → Vercel en producción
            │
            │   fetch → REST /api/v1
            │   JWT en la cabecera Authorization
            ▼
    Backend (FastAPI)                       → Render en producción
       ├── api/        recibe la petición y valida la entrada (Pydantic)
       ├── services/   aplica la lógica de negocio
       └── models/     consulta la base de datos (SQLAlchemy)
            │
            ▼
       PostgreSQL                           → Neon en producción
```

Las tres piezas están **desacopladas**: el frontend no sabe nada de la base de
datos, solo conoce el contrato REST bajo `/api/v1`. Eso permite que cada una viva
en un proveedor distinto y se despliegue por separado.

Dentro del backend, la petición atraviesa **tres capas con responsabilidades
separadas**: `api/` se ocupa de lo que es HTTP (rutas, códigos de estado,
validación de entrada), `services/` contiene la lógica de negocio sin saber que
existe la web, y `models/` es lo único que habla con la base de datos. Por eso la
lógica financiera se puede probar sin levantar un servidor.

Dos reglas atraviesan todo el flujo:

- **Aislamiento por usuario.** Cada consulta se filtra por el usuario del token.
  Nadie puede ver ni tocar los movimientos de otro, ni adivinando identificadores
  (las claves primarias son UUID, no enteros correlativos).
- **Los importes nunca pierden precisión.** `Decimal` en Python, `NUMERIC` en
  PostgreSQL y *string* en el JSON, de punta a punta.

## Funcionalidades principales

**Autenticación y perfil**
Registro con **nick único** y contraseña robusta (medidor de fuerza en vivo, se
rechazan las comunes y las que contengan tu email o nick). Login con **email o
nick**, indistintamente. La sesión usa JWT con *refresh* rotable y revocable, y
hay una pantalla de perfil para cambiar el nick.

**Movimientos**
Alta individual con **"Añadir movimiento"** —tipo, importe, concepto, fecha y
categoría— para lo que no viene del banco: el efectivo, un préstamo a un amigo,
lo que sea. El listado va del más reciente al más antiguo, con filtros por tipo,
categoría y rango de fechas.

Cada movimiento **se despliega al pulsarlo** y muestra su detalle: el importe en
grande, la fecha, la categoría y **a qué cubo del 50-30-20 pertenece**. Desde ahí,
tres acciones:

- **Editar** — cambiar cualquier campo.
- **Dividir** — partir un movimiento en varios, cada uno con su categoría. Un
  recibo de 90 € del supermercado que en realidad eran 70 € de comida y 20 € de
  menaje se convierte en dos movimientos, y cada trozo cae en el cubo que le
  toca. Las partes heredan tipo, concepto y fecha del original, y **la suma tiene
  que cuadrar al céntimo** con el importe de partida: si no, se rechaza. Sin
  esto, un solo recibo mezclado falsearía el reparto del mes.
- **Borrar** — con confirmación.

**Categorías**
79 categorías semilla ya mapeadas a los cubos del 50-30-20, más las que quieras
crear. Cada una con su emoji, para reconocerla de un vistazo.

**Importación de extractos CSV**
Subes el CSV del banco (formato imagin/CaixaBank) y ves una **vista previa antes
de confirmar**: qué categoría se le ha asignado a cada fila, cuáles están
**marcadas como duplicadas** y cuáles quedan a revisar. Puedes corregir cualquier
fila o excluirla. **Nada se guarda hasta que confirmas.** El parser es tolerante:
entiende el formato español (`-6,40EUR`, `11.766,93EUR`), las fechas
`dd/mm/yyyy`, y avisa de las filas malformadas sin romperse.

**Clasificación que aprende**
Dos capas, sin IA externa: primero tus **reglas aprendidas**, después un
**diccionario de comercios españoles**. Lo que no reconoce queda "a revisar" y,
en cuanto lo categorizas, **lo aprende**: la próxima vez que aparezca ese
comercio, acierta solo.

**Regla 50-30-20 con semáforo — y el reparto lo decides tú**
El 50/30/20 es el punto de partida, **no una imposición**. Desde **"Ajustar
presupuesto"** cambias el reparto entre Vida, Mes e Inversión al que encaje con
tu vida —60/20/20 si la vivienda te aprieta, 40/30/30 si quieres invertir más—
con la única condición de que **sume 100**. Porque una regla que no puedes
adaptar a tu situación es una regla que acabas ignorando.

Cada cubo tiene su **semáforo** —verde, ámbar, rojo— para que veas que te estás
pasando **cuando aún puedes hacer algo**, no al cerrar el mes. Lo no computable
(traspasos entre tus cuentas, aportes a inversión) queda fuera del cálculo: no es
dinero que se va, es dinero que se mueve.

**Ingreso mensual variable**
Porque el sueldo no es el mismo todos los meses. Cada mes de cada año puede tener
su propio ingreso —una paga extra, una subida, un mes flojo— con un "ingreso
habitual" de respaldo para los que no ajustes.

**Colchón de emergencia**
Defines cuánto necesitas para vivir al mes y cuántos meses quieres cubrir (3-6):
Numario calcula el objetivo y sigue el progreso. Registras tus aportaciones con
su fecha y ves cuánto te falta.

**Dashboard y análisis**
La pantalla de inicio responde a *"¿cómo voy este mes?"*: ingresos contra gastos,
neto del mes, últimos movimientos, ritmo de gasto y evolución de los últimos 6
meses. La de análisis va al detalle: reparto 50-30-20, gasto por categoría,
previsto contra gastado, y navegación por **meses o años**.

**Tema claro y oscuro**
Con conmutador, memoria de tu elección y respeto por la preferencia de tu
sistema.

## Usuario y contraseña de prueba

Entra en **<https://numario.vercel.app>** con:

```
Usuario:     mouredev@gmail.com    (o el nick: mouredev)
Contraseña:  Ahorr0!Constante
```

La cuenta viene con **dos años de datos reales**: 2025 completo y 2026 hasta la
fecha, 372 movimientos que cuentan una historia coherente —alguien que en 2025
vivía de alquiler y en 2026 compra piso y le suben el sueldo en abril—.

Los importes están elegidos a propósito para que **se vean todos los casos** y no
salga todo en verde:

| Qué mirar | Dónde |
| --- | --- |
| Cubo **Vida** en rojo y en ámbar | 02/2026 (avería del coche) · 05/2026 (dentista) |
| Cubo **Mes** en rojo y en ámbar | 03/2026 (caprichos) · 06/2026 (viaje) |
| **Ingreso variable** | Subida de sueldo en 04/2026 · pagas extra en junio y diciembre |
| Movimiento **sin categoría** | "Cargo sin identificar" (20/06/2026) |
| **Comparación entre años** | 2025 completo frente a 2026 |

> Si prefieres empezar de cero, puedes registrar tu propio usuario: el registro
> está abierto. Para regenerar los datos de demostración en un entorno local.
