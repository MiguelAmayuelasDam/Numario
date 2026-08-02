import { useMemo, useState } from "react"

import type { Asset, InvestmentGroup } from "@/lib/api"

// Paleta categórica (tokens en index.css, validados con la skill dataviz). Un
// color por grupo, en orden fijo. Los activos de un grupo comparten color y se
// distinguen por el hueco de 2px entre porciones y por la leyenda.
const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
]

interface Slice {
  assetId: string
  name: string
  fraction: number // % del total (0..1)
  color: string
}

/** Peso efectivo de un activo sobre el total: clase × grupo × activo (literal). */
function effectiveFraction(
  asset: Asset,
  groups: InvestmentGroup[],
  variablePct: number,
): number {
  const classFrac = (asset.asset_class === "variable" ? variablePct : 100 - variablePct) / 100
  const assetFrac = Number(asset.weight) / 100
  if (asset.group_id) {
    const group = groups.find((g) => g.id === asset.group_id)
    const groupFrac = group ? Number(group.weight) / 100 : 0
    return classFrac * groupFrac * assetFrac
  }
  return classFrac * assetFrac
}

/**
 * Donut del reparto de la cartera: una porción por activo, del tamaño de su peso
 * efectivo sobre el total. El color identifica el grupo; la leyenda, cada activo
 * con su porcentaje (así el color nunca es el único identificador).
 *
 * Si los pesos no cubren el 100%, se añade una porción gris "sin asignar" — fiel
 * al modelo de pesos literales.
 */
export function PortfolioDonut({
  assets,
  groups,
  variablePct,
}: {
  assets: Asset[]
  groups: InvestmentGroup[]
  variablePct: number
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  const { slices, unassigned } = useMemo(() => {
    // Un color por grupo (y uno por cada clase para los activos sueltos).
    const colorKeys: string[] = []
    const colorOf = (key: string): string => {
      let i = colorKeys.indexOf(key)
      if (i === -1) {
        i = colorKeys.length
        colorKeys.push(key)
      }
      return SERIES[i % SERIES.length]
    }
    const out: Slice[] = []
    let assigned = 0
    for (const asset of assets) {
      const fraction = effectiveFraction(asset, groups, variablePct)
      if (fraction <= 0) continue
      const key = asset.group_id ?? `loose:${asset.asset_class}`
      out.push({ assetId: asset.id, name: asset.name, fraction, color: colorOf(key) })
      assigned += fraction
    }
    return { slices: out, unassigned: Math.max(0, 1 - assigned) }
  }, [assets, groups, variablePct])

  if (slices.length === 0) return null

  const size = 200
  const stroke = 34
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = 2 // px de hueco entre porciones (separa las del mismo color)

  const segments = [...slices, ...(unassigned > 0.0001
    ? [{ assetId: "unset", name: "Sin asignar", fraction: unassigned, color: "var(--series-unset)" }]
    : [])]

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
                key={s.assetId}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={s.color}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                opacity={hovered && hovered !== s.assetId ? 0.35 : 1}
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
            key={s.assetId}
            className="flex items-center gap-2"
            onMouseEnter={() => setHovered(s.assetId)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
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
