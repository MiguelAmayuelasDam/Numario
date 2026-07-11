"""Agregador de routers de la API v1."""

from fastapi import APIRouter

from app.api.v1 import analytics, auth, budget, categories, forecast, imports, transactions

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(imports.router)
api_router.include_router(budget.router)
api_router.include_router(analytics.router)
api_router.include_router(forecast.router)
