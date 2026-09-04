# Backlog — tareas pendientes

Tareas ya **planificadas** (con su solución diseñada) pero **aún sin implementar**.
Al cerrar una, se traslada su resumen a
[`glosario-funcionalidades.md`](glosario-funcionalidades.md) y se quita de aquí.

---

## 1. Despliegue gratuito (Render → plan Free)

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
- **Neon y Vercel siguen gratis**; el **auto-deploy desde `main`** sigue funcionando
  en Free.

**Comportamiento del plan Free (arranque en frío).** El servicio **se duerme tras
~15 min sin tráfico** y **despierta solo con la siguiente petición HTTP** — no hay
que arrancarlo a mano en el panel.
- En esta app se nota así: el **frontend (Vercel) nunca duerme** y carga al instante;
  la **primera acción que llama al backend** (login, cargar datos) es la que lo
  despierta. Render **retiene** esa petición mientras arranca (~**30-60 s**, no la
  rechaza) y luego responde. El `fetch` del frontend **no tiene timeout**, así que
  espera y no da error; a partir de ahí, fluido hasta el siguiente reposo.
- **Despertar manualmente** (útil antes de la defensa, para no esperar en directo):
  visitar `https://numario.onrender.com/ping` ~1 min antes deja el backend caliente.
  Es lo mismo que haría el pinger, pero puntual.
- Si alguna vez el arranque se atasca, un **F5** cuando ya está arriba lo resuelve.
- Documentado también en el `README.md` (sección de usuario de prueba), para quien
  acceda al despliegue.

**Opcional — evitar el arranque en frío.** Un **pinger externo gratuito**
(cron-job.org o UptimeRobot) que llame cada ~10–14 min a
`https://numario.onrender.com/ping`.
- Se usa **`/ping`** (no `/health`) **a propósito**: no toca la BD, así que **no
  despierta Neon** ni gasta sus horas de cómputo gratis.
- Mantenerla despierta 24/7 consume **~730 h/mes** y Render Free da **750 h/mes** →
  cabe, pero justo (ojo si se añade otro servicio Free en la misma cuenta).

> **La tarea de responsive móvil ya está implementada** (rama
> `feat/responsive-movil`) → su resumen vive en
> [`glosario-funcionalidades.md`](glosario-funcionalidades.md).
