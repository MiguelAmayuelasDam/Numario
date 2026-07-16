// Utilidades de importes compartidas por los formularios (movimiento, ingreso,
// previsto, aportación al colchón). El tope está alineado con el backend
// (`MAX_AMOUNT` en app/schemas/common.py).

/** Tope máximo de cualquier importe editable. */
export const MAX_AMOUNT = 9_999_999

/** ¿El valor tecleado está dentro del tope? (vacío se permite mientras se escribe). */
export function withinCap(value: string): boolean {
  return value === "" || Number(value) <= MAX_AMOUNT
}
