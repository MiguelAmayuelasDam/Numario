import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { ContributionDialog } from "@/components/ContributionDialog"
import { PortfolioDonut } from "@/components/PortfolioDonut"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ApiError,
  type Contribution,
  type InvestmentGroup,
  type MonthAsset,
  api,
} from "@/lib/api"
import { formatDateHeader, formatMoney, todayISO } from "@/lib/format"

const ALL_GROUPS = "all"
const NO_GROUP = "none"

/**
 * Estado real de la cartera: lo que **de verdad** has aportado a cada activo (no
 * el reparto teórico). Un donut con el peso real de cada activo por lo aportado,
 * y al elegir uno, su total y el listado de todas sus aportaciones por fecha
 * (incluidas las extra). Registra lo real, pasado o presente.
 */
export default function PortfolioState() {
  const [rows, setRows] = useState<MonthAsset[]>([])
  const [groups, setGroups] = useState<InvestmentGroup[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [groupFilter, setGroupFilter] = useState<string>(ALL_GROUPS)
  const [assetHistory, setAssetHistory] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contribDialog, setContribDialog] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // El total_contributed es de toda la historia (no depende del día); la fecha
      // solo hace falta porque el endpoint la pide.
      const [grps, statusRows] = await Promise.all([
        api.investment.listGroups(),
        api.investment.status(todayISO(), "0"),
      ])
      setGroups(grps)
      setRows(statusRows)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la cartera")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Filtro por grupo: "todos", un grupo concreto, o "sin grupo" (activos sueltos).
  const inFilter = useCallback(
    (r: MonthAsset) =>
      groupFilter === ALL_GROUPS
        ? true
        : groupFilter === NO_GROUP
          ? !r.asset.group_id
          : r.asset.group_id === groupFilter,
    [groupFilter],
  )

  // Al cambiar el filtro (o recargar), si el activo elegido ya no encaja, salta al
  // de más aportado dentro del filtro.
  useEffect(() => {
    const filtered = rows.filter(inFilter)
    setSelectedId((prev) => {
      if (filtered.some((r) => r.asset.id === prev)) return prev
      const best = [...filtered].sort(
        (a, b) => Number(b.total_contributed) - Number(a.total_contributed),
      )
      return best[0]?.asset.id ?? ""
    })
  }, [rows, inFilter])

  const loadHistory = useCallback((id: string) => {
    if (!id) {
      setAssetHistory([])
      return
    }
    api.investment.history(id).then(setAssetHistory).catch(() => setAssetHistory([]))
  }, [])

  // Al cambiar el activo seleccionado, se cargan sus aportaciones.
  useEffect(() => {
    loadHistory(selectedId)
  }, [selectedId, loadHistory])

  const filteredRows = rows.filter(inFilter)
  const hasLoose = rows.some((r) => !r.asset.group_id)
  const totalInvested = filteredRows.reduce((s, r) => s + Number(r.total_contributed), 0)
  const donutItems = filteredRows
    .filter((r) => Number(r.total_contributed) > 0)
    .map((r) => ({
      id: r.asset.id,
      name: r.asset.name,
      fraction: totalInvested > 0 ? Number(r.total_contributed) / totalInvested : 0,
    }))
  const selected = rows.find((r) => r.asset.id === selectedId)
  const overallInvested = rows.reduce((s, r) => s + Number(r.total_contributed), 0)

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Estado real</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/cartera" className="text-sm text-primary hover:underline">
            ← Volver a la cartera
          </Link>
          {rows.length > 0 ? (
            <Button variant="outline" onClick={() => setContribDialog(true)}>
              Aportación extra
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Cargando…</p>
      ) : overallInvested <= 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Aún no has aportado nada.</p>
          <p>
            Cuando registres aportaciones (desde la cartera o con «Aportación extra»), aquí verás
            cuánto llevas invertido de verdad en cada activo.
          </p>
        </div>
      ) : (
        <>
          {/* Filtro por grupo */}
          {groups.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Label htmlFor="state-group" className="text-sm text-muted-foreground">
                Grupo
              </Label>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger id="state-group" aria-label="Filtrar por grupo" className="min-w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_GROUPS}>Todos los grupos</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                  {hasLoose ? <SelectItem value={NO_GROUP}>Sin grupo</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Donut de lo aportado por activo + total invertido */}
          <section className="mb-6 rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
              <h2 className="font-semibold">Aportado por activo</h2>
              <p className="text-sm text-muted-foreground">
                Total invertido:{" "}
                <span className="font-semibold text-foreground">{formatMoney(totalInvested)}</span>
              </p>
            </div>
            {totalInvested > 0 ? (
              <PortfolioDonut items={donutItems} />
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Este grupo aún no tiene aportaciones.
              </p>
            )}
          </section>

          {/* Detalle por activo */}
          <section className="rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="state-asset">Activo</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger id="state-asset" aria-label="Activo" className="min-w-48">
                    <SelectValue placeholder="Elige un activo" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRows.map((r) => (
                      <SelectItem key={r.asset.id} value={r.asset.id}>
                        {r.asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-right">
                <span className="block text-xs text-muted-foreground">Aportado en total</span>
                <span className="text-2xl font-bold tabular-nums">
                  {formatMoney(selected?.total_contributed ?? "0")}
                </span>
              </div>
            </div>

            {assetHistory.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin aportaciones a este activo todavía.
              </p>
            ) : (
              <ul className="divide-y">
                {assetHistory.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">
                        {formatDateHeader(c.occurred_on)}
                      </span>
                      {c.concept.startsWith("Aportación extra") ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          Aportación extra
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-income">
                      +{formatMoney(c.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <ContributionDialog
        open={contribDialog}
        groups={groups}
        assets={rows.map((r) => r.asset)}
        onOpenChange={setContribDialog}
        onSaved={() => {
          setContribDialog(false)
          void load()
          loadHistory(selectedId)
        }}
      />
    </main>
  )
}
