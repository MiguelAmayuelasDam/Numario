"""Punto de entrada de la API FastAPI."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import health
from app.api.v1 import api_router
from app.core.config import settings
from app.core.rate_limit import limiter

app = FastAPI(title="Numario API", version="0.1.0")

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
