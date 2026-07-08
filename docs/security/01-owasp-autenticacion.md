# Seguridad de la autenticación — OWASP

Controles aplicados en el bloque de autenticación (Fase 2) y su mapeo con el
OWASP Top 10. Documento vivo: se ampliará al endurecer el resto de la API.

## Controles implementados

### Contraseñas
- **Hash con argon2id** (`pwdlib`), nunca en claro ni reversible.
- **Política de robustez** (`app/core/password_policy.py`), validada en backend
  (fuente de verdad) y reflejada en el frontend para feedback en vivo:
  ≥ 8 caracteres, mayúscula, minúscula, número y símbolo; se **rechazan
  contraseñas comunes** y las que contengan el email o el nick.
- Verificación en **tiempo constante** con hash señuelo cuando el usuario no
  existe → mitiga enumeración de usuarios por diferencia de tiempos.

### Tokens
- **Access token JWT HS256** de vida corta (15 min por defecto), firmado con un
  secreto de ≥ 32 bytes provisto por entorno.
- **Refresh tokens opacos** (`secrets.token_urlsafe`), persistidos **solo como
  `sha256`** (si se filtra la DB, no se pueden usar). Son **revocables** y
  **rotan** en cada renovación: reutilizar uno rotado falla (detección básica de
  robo de token). El logout revoca de verdad.

### Superficie de API
- **Validación estricta con Pydantic** en todas las entradas (email, nick,
  longitudes, patrón del nick).
- **Rate limiting** en `/auth/login` (`slowapi`, 5/min por IP por defecto) para
  frenar fuerza bruta y credential stuffing.
- **UUID** como clave primaria → evita enumeración de recursos por ID.
- **Secretos solo por entorno** (`.env`/settings), nunca en el repositorio.

### Almacenamiento en el cliente (trade-off asumido)
- Los tokens se guardan en **`localStorage`** con envío por cabecera
  `Authorization: Bearer`. Es simple y evita CSRF (no viajan como cookie
  automática), a costa de exposición ante **XSS**.
- **Mitigaciones del XSS**: React escapa el render por defecto, no se usa
  `dangerouslySetInnerHTML`, access token de vida corta y refresh revocable.
  Alternativa futura: cookie `HttpOnly` + protección CSRF si el modelo de
  amenaza lo requiere.

## Mapeo OWASP Top 10 (2021)

| Riesgo | Control |
| ------ | ------- |
| A01 Broken Access Control | Rutas protegidas con dependencia `get_current_user`; refresh ligado al usuario. |
| A02 Cryptographic Failures | argon2id para contraseñas; JWT firmado; refresh guardado como sha256. |
| A03 Injection | SQLAlchemy parametrizado; validación Pydantic. |
| A04 Insecure Design | Rotación + revocación de refresh; política de contraseñas; verificación en tiempo constante. |
| A05 Security Misconfiguration | Secretos por entorno; CORS restringido a orígenes conocidos. |
| A07 Identification & Auth Failures | Rate limiting en login; hash fuerte; bloqueo de contraseñas comunes; anti-enumeración. |

## Pendiente (fases posteriores)
- Escaneo de dependencias en CI (Bandit, pip-audit, npm audit) — Fase 6.
- Revisión completa del OWASP Top 10 sobre toda la API — Fase 6.
