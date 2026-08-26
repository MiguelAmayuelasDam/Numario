import { useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"]
const monthFmt = new Intl.DateTimeFormat("es-ES", { month: "long" })
const YEARS_PER_PAGE = 12

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

// Calendario mensual mínimo. `value`/`onSelect` usan fechas ISO (YYYY-MM-DD).
// `marked` resalta con un punto los días con algo (p. ej. aportaciones).
// El título es un botón que abre una **rejilla de años** para saltar de año sin
// tener que desplazarse mes a mes.
export function Calendar({
  value,
  onSelect,
  min,
  max,
  marked,
}: {
  value?: string
  onSelect: (isoDate: string) => void
  min?: string
  max?: string
  marked?: Set<string>
}) {
  const initial = value ? new Date(`${value}T00:00:00`) : new Date()
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1))
  const [mode, setMode] = useState<"days" | "years">("days")
  const [yearsStart, setYearsStart] = useState(
    () => Math.floor(initial.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE,
  )

  const year = view.getFullYear()
  const month = view.getMonth()
  const minYear = min ? Number(min.slice(0, 4)) : undefined
  const maxYear = max ? Number(max.slice(0, 4)) : undefined

  const openYears = () => {
    setYearsStart(Math.floor(year / YEARS_PER_PAGE) * YEARS_PER_PAGE)
    setMode("years")
  }
  const pickYear = (y: number) => {
    setView(new Date(y, month, 1))
    setMode("days")
  }

  // ── Vista de años: rejilla de 12, con flechas para el bloque anterior/siguiente.
  if (mode === "years") {
    const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearsStart + i)
    return (
      <div className="w-64">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Años anteriores"
            onClick={() => setYearsStart(yearsStart - YEARS_PER_PAGE)}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-medium">
            {yearsStart} – {yearsStart + YEARS_PER_PAGE - 1}
          </span>
          <button
            type="button"
            aria-label="Años siguientes"
            onClick={() => setYearsStart(yearsStart + YEARS_PER_PAGE)}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {years.map((y) => {
            const disabled =
              (minYear !== undefined && y < minYear) || (maxYear !== undefined && y > maxYear)
            const selected = y === year
            return (
              <button
                key={y}
                type="button"
                disabled={disabled}
                onClick={() => pickYear(y)}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md text-sm transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground",
                  disabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
                )}
              >
                {y}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Vista de días (por defecto).
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = (new Date(year, month, 1).getDay() + 6) % 7 // lunes = 0
  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const monthLabel = monthFmt.format(view)
  const monthName = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

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
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{monthName}</span>
          {/* El año va suelto, como un desplegable (flechita ▾): así se ve que es
              seleccionable sin tener que ir mes a mes. */}
          <button
            type="button"
            aria-label="Elegir año"
            onClick={openYears}
            className="flex items-center gap-0.5 rounded-md border px-2 py-0.5 text-sm font-semibold hover:bg-accent"
          >
            {year}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </span>
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
          const isMarked = marked?.has(isoDay) ?? false
          return (
            <button
              key={isoDay}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(isoDay)}
              className={cn(
                "relative flex size-8 items-center justify-center rounded-md text-sm transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground",
                disabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
              )}
            >
              {day}
              {isMarked ? (
                <span
                  className={cn(
                    "absolute bottom-1 size-1 rounded-full",
                    selected ? "bg-primary-foreground" : "bg-invest",
                  )}
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
