"""Agregador de routers de la API v1."""

from fastapi import APIRouter

from app.api.v1 import auth, categories, transactions

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
