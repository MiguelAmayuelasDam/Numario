# Backlog — tareas pendientes

Tareas ya **planificadas** (con su solución diseñada) pero **aún sin implementar**.
Al cerrar una, se traslada su resumen a
[`glosario-funcionalidades.md`](glosario-funcionalidades.md) y se quita de aquí.

---

## 1. Recuperación de contraseña por correo

**Estado:** pendiente · **Alcance:** medio · **Bloqueo:** elegir proveedor de email
y crear su API key (lo hace el autor).

**Problema.** No hay forma de recuperar la cuenta si se olvida la contraseña, y no
existe ninguna verificación por correo. La pregunta "¿cómo verifico que es el
usuario real?" se resuelve precisamente con el correo: **la posesión de la bandeja
es la prueba de identidad**. Es el estándar y, bien hecho, es seguro.

**Solución diseñada (flujo).**
1. En login → enlace "¿Olvidaste tu contraseña?" → el usuario introduce su email.
2. Backend genera un **token de un solo uso, caducable (~1 h) y guardado hasheado**
   (mismo patrón que los refresh tokens) y envía un correo con un enlace
   `…/reset-password?token=XXX`. **Responde siempre lo mismo** ("si el email existe,
   te hemos enviado un correo") para **no revelar** qué correos están registrados
   (evita enumeración de usuarios). Endpoint **rate-limited**, como el login.
3. El usuario abre el enlace → formulario de nueva contraseña, reutilizando el
   **medidor de fuerza** y la **política** de contraseña que ya existen.
4. Backend valida el token (existe, no caducado, no usado) → cambia el hash →
   **invalida el token** y **revoca los refresh tokens** (cierra sesión en todas
   partes) por seguridad.

**Lo nuevo que hace falta.**
- **Proveedor de email** (hoy la app no envía correos). Recomendado: **Resend**
  (plan gratis, API HTTP sencilla); alternativas: SendGrid / Mailgun / Amazon SES.
  Necesita una **API key** (secreto en variables de entorno de Render, como
  `JWT_SECRET`; **la configura el autor**, nunca en el repo) y un **remitente
  verificado**.
- Tabla nueva **`password_reset_token`** (`user_id`, `token_hash`, `expires_at`,
  `used`) + su migración Alembic.
- Endpoints **`POST /auth/forgot-password`** y **`POST /auth/reset-password`**.
- Frontend: enlace "¿Olvidaste tu contraseña?", pantalla de email y página
  `/reset-password`.
- **Tests (TDD)**, como toda la parte de autenticación.

**Decisiones pendientes:** proveedor de email (¿Resend?) · dirección remitente ·
caducidad del token (propuesta: 1 h).

---

## 2. Despliegue gratuito (Render → plan Free)

**Estado:** pendiente · **Alcance:** bajo (acción del autor en el panel de Render,
sin cambios de código).

**Contexto.** El backend está en Render en **plan de pago (Starter)** para evitar el
arranque en frío mientras el profesor corregía. Ya corregido y aprobado → se puede
**bajar a Free** para dejar de pagar manteniéndola desplegada.

**Solución.** En **Render → Web Service del backend → Settings → Instance Type →
Free**. Redespliega en la instancia gratuita y deja de cobrar.
- **No toca la base de datos** (Neon es un servicio aparte) → datos a salvo.
- Ya está **preparado en el código** desde la Fase 7: endpoint **`/ping`** (liveness
  sin BD), puerto desde **`$PORT`**, y la guarda de arranque en producción.
- **Comportamiento:** el plan Free **se duerme a los ~15 min** sin uso; la **primera
  visita** tras dormirse tarda **~1 min** (arranque en frío) y luego va fluido.
- **Neon y Vercel siguen gratis**; el **auto-deploy desde `main`** sigue funcionando
  en Free.

**Opcional — evitar el arranque en frío.** Un **pinger externo gratuito**
(cron-job.org o UptimeRobot) que llame cada ~10–14 min a
`https://numario.onrender.com/ping`.
- Se usa **`/ping`** (no `/health`) **a propósito**: no toca la BD, así que **no
  despierta Neon** ni gasta sus horas de cómputo gratis.
- Mantenerla despierta 24/7 consume **~730 h/mes** y Render Free da **750 h/mes** →
  cabe, pero justo (ojo si se añade otro servicio Free en la misma cuenta).

---

## 3. Adaptar la web a móvil (responsive vertical)

**Estado:** pendiente · **Alcance:** medio · **Sin bloqueos** (se puede empezar
cuando se quiera).

**Problema (probado a 390 px, móvil vertical).** La app es "desktop-first". El
**problema raíz es el overflow horizontal**: varias filas de controles/tablas no se
reajustan al ancho del móvil, así que la página es **más ancha que la pantalla**
(contenido pegado a la izquierda, scroll lateral, controles apretados). Eso es lo
que "se ve raro".

**Solución diseñada (por prioridad).**
1. **Barra de navegación superior** — los enlaces + toggle de tema + saludo "Hola,
   …" + avatar van apretados en una sola fila. En móvil → **menú hamburguesa** (o
   barra inferior de pestañas) y acortar/ocultar el saludo.
2. **Overflow horizontal global** — garantizar que el `body` nunca haga scroll
   lateral; que las filas anchas **envuelvan** o hagan scroll **dentro de su propio
   contenedor**.
3. **Cabeceras con botones de acción:**
   - **Cartera:** el título se solapa con `[Aportación extra] [Añadir grupo] [Añadir
     activo]` → **apilar** en móvil.
   - **Movimientos:** filtros + búsqueda + `[Nuevo movimiento]` se salen → apilar /
     colapsar los filtros.
4. **Análisis:** quitar el **`zoom: 1.1`** en móvil (agranda todo un 10% y empeora el
   ajuste) y **reflow de la tabla "Categorías: gastado vs previsto"** (4 columnas,
   demasiado ancha → tarjeta por categoría o apilar columnas).
5. **Áreas táctiles** — algún "Editar" / checkbox pequeño se puede agrandar para el
   dedo.

**Enfoque:** un pase de responsive con Tailwind (breakpoints `sm:`), empezando por
la **nav** y el **overflow horizontal** (lo más visible), y luego las cabeceras y la
tabla de Análisis.
