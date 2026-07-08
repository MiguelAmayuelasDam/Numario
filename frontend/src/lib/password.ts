// Evaluación de robustez de contraseña en cliente. Refleja la política del
// backend (app/core/password_policy.py) para dar feedback en vivo; el backend
// sigue siendo la fuente de verdad que valida en el registro.

export interface PasswordChecks {
  length: boolean
  upper: boolean
  lower: boolean
  digit: boolean
  symbol: boolean
  notCommon: boolean
  notIdentity: boolean
}

export interface PasswordEvaluation {
  checks: PasswordChecks
  score: number // 0–5
  valid: boolean
}

// Subconjunto reducido de contraseñas comunes (alineado con el backend).
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "qwerty",
  "qwerty123",
  "111111",
  "123123",
  "abc123",
  "iloveyou",
  "admin",
  "welcome",
  "letmein",
  "monkey",
  "dragon",
  "sunshine",
  "1q2w3e4r",
  "qazwsx",
  "p@ssw0rd",
  "contraseña",
  "numario",
])

export interface Identity {
  email?: string
  nickname?: string
}

export function evaluatePassword(password: string, identity: Identity = {}): PasswordEvaluation {
  const lowered = password.toLowerCase()

  const nick = identity.nickname?.trim().toLowerCase() ?? ""
  const emailLocal = identity.email?.split("@")[0]?.trim().toLowerCase() ?? ""
  const containsIdentity =
    (nick.length > 0 && lowered.includes(nick)) ||
    (emailLocal.length > 0 && lowered.includes(emailLocal))

  const checks: PasswordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
    notCommon: !COMMON_PASSWORDS.has(lowered),
    notIdentity: !containsIdentity,
  }

  // Score 0–5 para el medidor: 5 clases de carácter, penalizando común/identidad.
  const classes = [checks.length, checks.upper, checks.lower, checks.digit, checks.symbol]
  let score = classes.filter(Boolean).length
  if (!checks.notCommon || !checks.notIdentity) {
    score = Math.min(score, 1)
  }

  const valid = Object.values(checks).every(Boolean)
  return { checks, score, valid }
}
