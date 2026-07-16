"""Punto de entrada de la API FastAPI."""

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import health
from app.api.v1 import api_router
from app.core.config import settings
from app.core.rate_limit import limiter

app = FastAPI(title="Numario API", version="0.1.0")

# Cabeceras de seguridad básicas (OWASP A05 — Security Misconfiguration).
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
}


@app.middleware("http")
async def _security_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    for name, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(name, value)
    return response

# Rate limiting (slowapi): estado en la app + handler 429.
app.state.limiter = limiter
# slowapi tipa el handler de forma no compatible con Starlette; es correcto en runtime.
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# /health en la raíz (concern de infraestructura); el dominio va bajo /api/v1.
app.include_router(health.router)
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    """Tarjeta de presentación de la API.

    El dominio vive bajo `/api/v1`, así que sin esto la raíz devuelve un 404 a
    quien abra la URL del servicio en el navegador: correcto, pero desconcertante.
    """
    return {
        "name": app.title,
        "version": app.version,
        "docs": "/docs",
        "health": "/health",
    }
