"""Instancia compartida del rate limiter (slowapi).

Vive en su propio módulo para poder importarla tanto en el router de auth (para
el decorador `@limiter.limit`) como en `main.py` (handler + estado de la app),
sin ciclos de importación.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# key por IP del cliente. En los tests se desactiva con `limiter.enabled = False`.
limiter = Limiter(key_func=get_remote_address)
