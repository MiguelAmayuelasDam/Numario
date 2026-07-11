import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"]
const monthFmt = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

// Calendario mensual mínimo. `value`/`onSelect` usan fechas ISO (YYYY-MM-DD).
export function Calendar({
  value,
  onSelect,
  min,
  max,
}: {
  value?: string
  onSelect: (isoDate: string) => void
  min?: string
  max?: string
}) {
  const initial = value ? new Date(`${value}T00:00:00`) : new Date()
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1))

  const year = view.getFullYear()
  const month = view.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = (new Date(year, month, 1).getDay() + 6) % 7 // lunes = 0

  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const label = monthFmt.format(view)
  const monthTitle = label.charAt(0).toUpperCase() + label.slice(1)

  return (
    <div className="w-64">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setView(new Date(year, month - 1, 1))}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">{monthTitle}</span>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setView(new Date(year, month + 1, 1))}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`b${i}`} />
          const isoDay = iso(year, month, day)
          const disabled = (min !== undefined && isoDay < min) || (max !== undefined && isoDay > max)
          const selected = value === isoDay
          return (
            <button
              key={isoDay}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(isoDay)}
              className={cn(
                "flex size-8 items-center justify-center rounded-md text-sm transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground",
                disabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
