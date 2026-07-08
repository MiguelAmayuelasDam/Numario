"""Política de robustez de contraseñas.

Fuente única de verdad del backend. La usan tanto el schema Pydantic de registro
como cualquier otro punto que necesite validar. Devuelve la lista de requisitos
incumplidos (vacía = contraseña válida) para poder mostrárselos al usuario.
"""

import re

MIN_LENGTH = 8
MAX_LENGTH = 128

# Conjunto embebido de contraseñas comunes (subconjunto representativo). Se
# comparan en minúsculas. Mantener alineado con el set del frontend.
COMMON_PASSWORDS: frozenset[str] = frozenset(
    {
        "password",
        "password1",
        "password123",
        "passw0rd",
        "12345678",
        "123456789",
        "1234567890",
        "qwerty",
        "qwertyui",
        "qwerty123",
        "111111",
        "123123",
        "abc123",
        "iloveyou",
        "admin",
        "administrator",
        "welcome",
        "welcome1",
        "letmein",
        "monkey",
        "dragon",
        "sunshine",
        "princess",
        "football",
        "baseball",
        "master",
        "superman",
        "batman",
        "trustno1",
        "whatever",
        "starwars",
        "hello123",
        "changeme",
        "secret",
        "google",
        "michael",
        "ashley",
        "shadow",
        "michelle",
        "jordan",
        "hunter2",
        "zaq12wsx",
        "1q2w3e4r",
        "qazwsx",
        "passw0rd!",
        "p@ssw0rd",
        "contraseña",
        "contrasena",
        "numario",
    }
)

_UPPER = re.compile(r"[A-Z]")
_LOWER = re.compile(r"[a-z]")
_DIGIT = re.compile(r"\d")
_SYMBOL = re.compile(r"[^A-Za-z0-9]")


def validate_password(
    password: str, *, email: str | None = None, nickname: str | None = None
) -> list[str]:
    """Devuelve los requisitos incumplidos. Lista vacía = contraseña válida."""
    errors: list[str] = []
    lowered = password.lower()

    if len(password) < MIN_LENGTH:
        errors.append(f"Debe tener al menos {MIN_LENGTH} caracteres")
    if len(password) > MAX_LENGTH:
        errors.append(f"No puede superar {MAX_LENGTH} caracteres")
    if not _UPPER.search(password):
        errors.append("Debe incluir al menos una mayúscula")
    if not _LOWER.search(password):
        errors.append("Debe incluir al menos una minúscula")
    if not _DIGIT.search(password):
        errors.append("Debe incluir al menos un número")
    if not _SYMBOL.search(password):
        errors.append("Debe incluir al menos un símbolo")
    if lowered in COMMON_PASSWORDS:
        errors.append("Es una contraseña demasiado común")

    if nickname:
        nick = nickname.strip().lower()
        if nick and nick in lowered:
            errors.append("No debe contener tu nick")
    if email:
        local = email.split("@", 1)[0].strip().lower()
        if local and local in lowered:
            errors.append("No debe contener tu email")

    return errors
