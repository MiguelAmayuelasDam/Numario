"""Configuración de la aplicación.

Única fuente de configuración: se lee de variables de entorno (o de un `.env`
en desarrollo). Los secretos nunca se hardcodean en el código (regla §7.4 de
CLAUDE.md).
"""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Default de desarrollo: si aparece en producción es que falta la variable real.
DEV_JWT_SECRET = "dev-only-secret-cambiar-en-produccion-000000"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Aplicación
    environment: str = "development"
    cors_origins: str = "http://localhost:5173"

    # Base de datos
    database_url: str = "postgresql+psycopg://numario:numario@localhost:5432/numario"

    # JWT. El secreto real llega por entorno; este default (solo dev) debe tener
    # ≥32 bytes para HS256 (RFC 7518 §3.2).
    jwt_secret_key: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # Rate limiting (formato de slowapi: "<n>/<periodo>")
    rate_limit_login: str = "5/minute"

    # Clasificación: proveedor de IA opcional (apagado por defecto → coste 0).
    # "none" = solo reglas + aprendizaje. Punto de extensión para el futuro.
    ai_provider: str = "none"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _no_dev_secrets_in_production(self) -> "Settings":
        """Falla al arrancar si producción usa el secreto de desarrollo.

        Es preferible que el despliegue no levante a que quede firmando tokens
        con un secreto que está publicado en el repositorio.
        """
        if self.environment == "production" and self.jwt_secret_key == DEV_JWT_SECRET:
            raise ValueError(
                "JWT_SECRET_KEY no está configurado: en producción no se puede usar "
                "el secreto de desarrollo. Define la variable de entorno."
            )
        return self


settings = Settings()
