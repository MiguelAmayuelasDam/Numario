"""Envío de correo — **enchufable y apagado por defecto**.

Proveedores (variable `EMAIL_PROVIDER`):
- ``console`` (por defecto): registra el enlace en el log; **no envía nada**. Sirve
  para desarrollo y tests, y para que el flujo funcione sin proveedor.
- ``resend``: envía de verdad con la API de Resend (necesita ``RESEND_API_KEY``).
- ``none``: silencioso, no hace nada.

Así el flujo de recuperación funciona en local sin proveedor, y en producción se
activa poniendo ``EMAIL_PROVIDER=resend`` + ``RESEND_API_KEY`` (+ un remitente
verificado en ``EMAIL_FROM``).
"""

import json
import logging
import urllib.error
import urllib.request

from app.core.config import settings

logger = logging.getLogger("numario.email")


def send_password_reset(*, to: str, reset_url: str) -> None:
    """Envía (o registra) el correo de recuperación de contraseña."""
    subject = "Recupera tu contraseña de Numario"
    text = (
        "Has pedido restablecer tu contraseña en Numario.\n\n"
        f"Abre este enlace para elegir una nueva (caduca en "
        f"{settings.password_reset_expire_minutes} minutos):\n"
        f"{reset_url}\n\n"
        "Si no has sido tú, ignora este correo; tu contraseña no cambiará."
    )
    _send(to=to, subject=subject, text=text, reset_url=reset_url)


def _send(*, to: str, subject: str, text: str, reset_url: str) -> None:
    provider = settings.email_provider
    if provider == "none":
        return
    if provider == "resend":
        _send_resend(to=to, subject=subject, text=text)
        return
    # "console": no envía; deja el enlace en el log para dev/tests.
    logger.info("[email:console] Para %s — enlace de reset: %s", to, reset_url)


def _send_resend(*, to: str, subject: str, text: str) -> None:
    if not settings.resend_api_key:
        logger.error("EMAIL_PROVIDER=resend pero falta RESEND_API_KEY; no se envía.")
        return
    payload = json.dumps(
        {"from": settings.email_from, "to": [to], "subject": subject, "text": text}
    ).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10):
            pass
    except urllib.error.HTTPError as e:
        logger.error("Resend devolvió %s: %s", e.code, e.read().decode()[:200])
    except (urllib.error.URLError, TimeoutError) as e:
        # No romper el flujo de reset si el proveedor falla; solo se registra.
        logger.error("No se pudo enviar el email: %s", e)
