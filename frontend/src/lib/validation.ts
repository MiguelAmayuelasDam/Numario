// Traduce los errores de validación (422) de FastAPI/Pydantic a mensajes claros
// en español, por campo, para poder resaltar el campo en conflicto.

interface PydanticError {
  type?: string
  loc?: (string | number)[]
  msg?: string
}

export type FieldErrors = Record<string, string>

function fieldFromLoc(loc: (string | number)[] | undefined): string {
  if (!loc || loc.length === 0) return "form"
  const last = loc[loc.length - 1]
  // Los errores a nivel de modelo tienen loc ["body"]; los tratamos como del form.
  return typeof last === "string" && last !== "body" ? last : "form"
}

function messageFor(field: string, err: PydanticError): string {
  const type = err.type ?? ""
  const raw = err.msg ?? ""

  if (field === "email") {
    return "Introduce un email válido (ejemplo: nombre@dominio.com)."
  }
  if (field === "nickname") {
    if (type.includes("too_short")) return "El nick debe tener al menos 3 caracteres."
    if (type.includes("too_long")) return "El nick no puede superar los 30 caracteres."
    if (type.includes("pattern")) {
      return "El nick solo admite letras, números y . _ - (sin espacios)."
    }
    if (type.includes("missing")) return "El nick es obligatorio."
    return "Revisa el nick."
  }
  if (field === "password") {
    if (type.includes("too_short")) return "La contraseña debe tener al menos 8 caracteres."
    // La política de contraseña llega como "Value error, <detalle en español>".
    if (type.includes("value_error")) return raw.replace(/^Value error,\s*/i, "")
    return "Revisa la contraseña."
  }
  if (field === "identifier") return "Introduce tu email o nick."
  return raw || "Revisa este campo."
}

// Convierte el `detail` de un 422 en un mapa campo → mensaje en español.
export function parseValidationErrors(detail: unknown): FieldErrors {
  if (!Array.isArray(detail)) return {}
  const errors: FieldErrors = {}
  for (const item of detail as PydanticError[]) {
    const field = fieldFromLoc(item.loc)
    // No pisamos el primer mensaje de cada campo.
    if (!errors[field]) errors[field] = messageFor(field, item)
  }
  return errors
}
