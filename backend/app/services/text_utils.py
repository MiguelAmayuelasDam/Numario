"""Utilidades de texto para el parseo y la clasificación de movimientos."""

import re
import unicodedata

_NON_ALNUM = re.compile(r"[^a-z0-9 ]+")
_SPACES = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Minúsculas, sin acentos y sin símbolos: base para comparar conceptos.

    Ej.: "WWW.AMAZON* YR49O" → "www amazon yr49o"; "ANTOÑANZAS" → "antonanzas".
    """
    stripped = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    lowered = stripped.lower()
    cleaned = _NON_ALNUM.sub(" ", lowered)
    return _SPACES.sub(" ", cleaned).strip()
