import type { Bucket, Transaction, TransactionType } from "@/lib/api"

// Color y etiqueta por cubo 50-30-20 (para el punto de color de cada categoría).
export const BUCKET_META: Record<Bucket, { label: string; dot: string }> = {
  living: { label: "Vida (50%)", dot: "bg-green-500" },
  monthly: { label: "Mes (30%)", dot: "bg-amber-500" },
  investment: { label: "Inversión (20%)", dot: "bg-blue-500" },
  income: { label: "Ingresos", dot: "bg-violet-500" },
  transfer: { label: "No computable", dot: "bg-gray-400" },
}

// Fecha de hoy en formato ISO (YYYY-MM-DD), para limitar los selectores de fecha.
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const moneyFmt = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Importe formateado en es-ES sin signo (p. ej. "1.000,00 €").
export function formatMoney(amount: string | number): string {
  return `${moneyFmt.format(Number(amount))} €`
}

// Importe con signo según el tipo: −gasto, +ingreso, sin signo si no computable.
export function signedAmount(amount: string, type: TransactionType): string {
  const value = moneyFmt.format(Number(amount))
  if (type === "expense") return `−${value} €`
  if (type === "income") return `+${value} €`
  return `${value} €`
}

export function formatSignedAmount(t: Transaction): string {
  return signedAmount(t.amount, t.type)
}

export function amountClass(type: TransactionType): string {
  if (type === "income") return "text-green-600"
  if (type === "transfer") return "text-muted-foreground"
  return "text-foreground"
}

const dateHeaderFmt = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
})

// "MIÉRCOLES 8 JUL. 2026" a partir de "2026-07-08".
export function formatDateHeader(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return dateHeaderFmt.format(date).toUpperCase()
}

export interface DateGroup {
  date: string
  items: Transaction[]
}

// Agrupa por fecha manteniendo el orden (la API ya devuelve reciente→antiguo).
export function groupByDate(transactions: Transaction[]): DateGroup[] {
  const groups: DateGroup[] = []
  for (const t of transactions) {
    const last = groups[groups.length - 1]
    if (last && last.date === t.occurred_on) {
      last.items.push(t)
    } else {
      groups.push({ date: t.occurred_on, items: [t] })
    }
  }
  return groups
}
