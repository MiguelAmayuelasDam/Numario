import { useMemo, useState } from "react"

// Paleta categórica (tokens en index.css, validados con la skill dataviz), en su
// orden fijo CVD-seguro. Cada activo lleva **su propio color**.
const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
]

/**
 * Color distinto para el activo `i`. Con más activos que colores base, se generan
 * variantes por niveles: los 7 hues base, luego una vuelta más clara y otra más
 * oscura (color-mix), sin salir de la paleta. Activos consecutivos siempre usan
 * hues distintos, así que nunca se tocan dos porciones iguales.
 */
function assetColor(i: number): string {
  const base = SERIES[i % SERIES.length]
  const tier = Math.floor(i / SERIES.length)
  if (tier === 0) return base
  if (tier % 2 === 1) return `color-mix(in oklch, ${base} 55%, white)`
  return `color-mix(in oklch, ${base} 62%, black)`
}

export interface DonutItem {
  id: string
  name: string
  fraction: number // parte del total (0..1)
}

interface Slice {
  id: string
  name: string
  fraction: number
  color: string
}

/**
 * Donut genérico: una porción por ítem, del tamaño de su fracción del total.
 * **Cada ítem con su propio color**, y la leyenda con su porcentaje (así el color
 * nunca es el único identificador).
 *
 * Si las fracciones no cubren el 100% y se pasa `unassignedLabel`, se añade una
 * porción gris con lo que falta (p. ej. "Sin asignar" en el reparto de la cartera).
 */
export function PortfolioDonut({
  items,
  unassignedLabel,
}: {
  items: DonutItem[]
  unassignedLabel?: string
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  const { slices, unassigned } = useMemo(() => {
    const out: Slice[] = []
    let assigned = 0
    for (const item of items) {
      if (item.fraction <= 0) continue
      out.push({ id: item.id, name: item.name, fraction: item.fraction, color: assetColor(out.length) })
      assigned += item.fraction
    }
    return { slices: out, unassigned: Math.max(0, 1 - assigned) }
  }, [items])

  if (slices.length === 0) return null

  const size = 200
  const stroke = 34
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = 2 // px de hueco entre porciones (separa las del mismo color)

  const segments =
    unassignedLabel && unassigned > 0.0001
      ? [...slices, { id: "unset", name: unassignedLabel, fraction: unassigned, color: "var(--series-unset)" }]
      : slices

  let offset = 0

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-44 shrink-0"
        role="img"
        aria-label="Reparto de la cartera por activo"
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`} fill="none" strokeWidth={stroke}>
          {segments.map((s) => {
            const len = s.fraction * c
            const dash = Math.max(0, len - gap)
            const seg = (
              <circle
                key={s.id}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={s.color}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                opacity={hovered && hovered !== s.id ? 0.35 : 1}
                style={{ transition: "opacity 0.15s" }}
              />
            )
            offset += len
            return seg
          })}
        </g>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1 text-sm">
        {segments.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2"
            onMouseEnter={() => setHovered(s.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
              {(s.fraction * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
