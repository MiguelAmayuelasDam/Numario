import type { Bucket, Transaction, TransactionType } from "@/lib/api"

// Color y etiqueta por cubo 50-30-20 (para el punto de color de cada categoría).
// `label` lleva el porcentaje por defecto y solo vale donde se explica la regla;
// `short` es el nombre a secas, para cabeceras y sitios donde el porcentaje del
// usuario puede no ser el de fábrica (son configurables).
export const BUCKET_META: Record<Bucket, { label: string; short: string; dot: string }> = {
  living: { label: "Vida (50%)", short: "Vida", dot: "bg-income" },
  monthly: { label: "Mes (30%)", short: "Mes", dot: "bg-bucket-amber" },
  investment: { label: "Inversión (20%)", short: "Inversión", dot: "bg-invest" },
  income: { label: "Ingresos", short: "Ingresos", dot: "bg-primary" },
  transfer: { label: "No computable", short: "No computable", dot: "bg-gray-400" },
}

// Orden en el que se presentan los cubos al usuario: primero los tres del
// 50-30-20 (que es de lo que va la app) y después ingresos y no computables.
// Alfabéticamente saldría "income, investment, living…", que no significa nada.
export const BUCKET_ORDER: Bucket[] = ["living", "monthly", "investment", "income", "transfer"]

/** Agrupa categorías por cubo, en el orden de `BUCKET_ORDER`, sin grupos vacíos. */
export function groupByBucket<T extends { bucket: Bucket }>(items: T[]): [Bucket, T[]][] {
  return BUCKET_ORDER.map((bucket): [Bucket, T[]] => [
    bucket,
    items.filter((item) => item.bucket === bucket),
  ]).filter(([, group]) => group.length > 0)
}

// Fecha de hoy en formato ISO (YYYY-MM-DD), para limitar los selectores de fecha.
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Días transcurridos del periodo [from, to] hasta hoy (mínimo 1). Sirve para
// medias por día y proyecciones (no cuenta días futuros del periodo).
export function daysElapsed(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00`)
  const t = new Date(`${to}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = today < t ? today : t
  return Math.max(1, Math.floor((end.getTime() - f.getTime()) / 86_400_000) + 1)
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
  if (type === "income") return "text-income"
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
