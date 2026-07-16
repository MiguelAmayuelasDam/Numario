"""Endpoint de health check.

Sirve tanto para monitorización como para el healthcheck de Docker. Comprueba la
conexión a la base de datos ejecutando un `SELECT 1`.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"
    return {"status": "ok", "db": db_status}


@router.get("/ping")
def ping() -> dict[str, str]:
    """Liveness **sin tocar la base de datos**.

    Es el endpoint para el health check de la plataforma y para los monitores de
    uptime. Importante: si sondearan `/health` (que hace `SELECT 1`), mantendrían
    la base de datos despierta 24/7 y agotarían las horas de cómputo del plan
    gratuito de Neon. Para diagnóstico real (¿llega a la DB?), usa `/health`.
    """
    return {"status": "ok"}
