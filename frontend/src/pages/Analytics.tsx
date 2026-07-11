import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ApiError,
  api,
  type AnalyticsOverview,
  type Budget,
  type BucketStat,
  type Granularity,
  type SeriesPoint,
} from "@/lib/api"
import { BUCKET_META, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

const STATUS_BAR: Record<BucketStat["status"], string> = {
  ok: "bg-green-500",
  warning: "bg-amber-500",
  over: "bg-red-500",
}

function daysElapsed(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00`)
  const t = new Date(`${to}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = today < t ? today : t
  return Math.max(1, Math.floor((end.getTime() - f.getTime()) / 86_400_000) + 1)
}

function BudgetDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [budget, setBudget] = useState<Budget | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      api.budget.get().then(setBudget).catch(() => setBudget(null))
      setError(null)
    }
  }, [open])

  if (!budget) return null

  const sum = budget.living_pct + budget.monthly_pct + budget.investment_pct
  const canSave = sum === 100 && Number(budget.monthly_income) >= 0 && !saving

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.budget.update(budget)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  const pctField = (key: "living_pct" | "monthly_pct" | "investment_pct", label: string) => (
    <div className="space-y-1">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min="0"
        max="100"
        value={budget[key]}
        onChange={(e) => setBudget({ ...budget, [key]: Number(e.target.value) })}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar presupuesto</DialogTitle>
          <DialogDescription>
            Tu ingreso mensual y el reparto 50-30-20 (los porcentajes deben sumar 100).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="income">Ingreso mensual (€)</Label>
            <Input
              id="income"
              type="number"
              min="0"
              step="0.01"
              value={budget.monthly_income}
              onChange={(e) => setBudget({ ...budget, monthly_income: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {pctField("living_pct", "Vida %")}
            {pctField("monthly_pct", "Mes %")}
            {pctField("investment_pct", "Inversión %")}
          </div>
          <p className={cn("text-sm", sum === 100 ? "text-muted-foreground" : "text-destructive")}>
            Suma: {sum}% {sum !== 100 ? "(debe ser 100)" : ""}
          </p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Analytics() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const [granularity, setGranularity] = useState<Granularity>("month")
  const [sel, setSel] = useState({ year: currentYear, month: today.getMonth() + 1 })
  const [navYear, setNavYear] = useState(currentYear) // año-ancla del navegador
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [budget, setBudget] = useState<Budget | null>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [forecasts, setForecasts] = useState<Record<string, string>>({})

  const loadOverview = useCallback(async () => {
    const [ov, bg] = await Promise.all([
      api.analytics.overview(granularity, sel.year, sel.month),
      api.budget.get(),
    ])
    setOverview(ov)
    setBudget(bg)
  }, [granularity, sel])

  const loadSeries = useCallback(async () => {
    setSeries(await api.analytics.series(granularity, navYear, 6))
  }, [granularity, navYear])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    void loadSeries()
  }, [loadSeries])

  // Inicializa los previstos editables desde el overview.
  useEffect(() => {
    if (!overview) return
    const map: Record<string, string> = {}
    for (const c of overview.categories) {
      if (c.category_id) map[c.category_id] = c.forecast ?? ""
    }
    setForecasts(map)
  }, [overview])

  const setForecastValue = (id: string, v: string) =>
    setForecasts((prev) => ({ ...prev, [id]: v }))

  const saveForecast = (id: string) => {
    const v = forecasts[id]
    void api.forecast.set(id, v && v !== "" ? v : "0").catch(() => {})
  }

  const switchGranularity = (g: Granularity) => {
    setGranularity(g)
    setSel({ year: currentYear, month: today.getMonth() + 1 })
    setNavYear(currentYear)
  }

  const step = granularity === "year" ? 6 : 1

  const maxVal = useMemo(
    () => Math.max(1, ...series.flatMap((p) => [Number(p.income), Number(p.expense)])),
    [series],
  )

  const isSelected = (p: SeriesPoint) =>
    p.year === sel.year && (granularity === "year" || p.month === sel.month)

  const maxCatSpent = overview
    ? Math.max(1, ...overview.categories.map((c) => Number(c.spent)))
    : 1

  const allocLabel = budget
    ? `${budget.living_pct}-${budget.monthly_pct}-${budget.investment_pct}`
    : "50-30-20"

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8" style={{ zoom: 1.1 }}>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Análisis</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/movimientos">Movimientos</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/">Inicio</Link>
          </Button>
        </div>
      </header>

      {/* Selector de periodo */}
      <div className="mb-3 flex gap-2">
        {(["month", "year"] as Granularity[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => switchGranularity(g)}
            className={cn(
              "rounded-full border px-4 py-1 text-sm",
              granularity === g
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            {g === "month" ? "Meses" : "Años"}
          </button>
        ))}
      </div>

      {/* Navegador con mini-barras ingresos/gastos (ocupa todo el ancho) */}
      <div className="mb-6 flex items-stretch gap-1 border-b pb-2">
        <button
          type="button"
          aria-label="Periodo anterior"
          onClick={() => setNavYear(navYear - step)}
          className="shrink-0 self-center rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex flex-1 items-end gap-1" data-testid="navigator">
          {series.map((p) => (
            <button
              key={`${p.year}-${p.month ?? "y"}`}
              type="button"
              onClick={() => setSel({ year: p.year, month: p.month ?? 1 })}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${p.label}: +${p.income} / −${p.expense}`}
            >
              <div className="flex h-12 items-end gap-0.5">
                <div
                  className="w-2 rounded-t bg-green-500"
                  style={{ height: `${(Number(p.income) / maxVal) * 100}%` }}
                />
                <div
                  className="w-2 rounded-t bg-red-500"
                  style={{ height: `${(Number(p.expense) / maxVal) * 100}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-xs",
                  isSelected(p) ? "font-bold text-foreground" : "text-muted-foreground",
                )}
              >
                {p.label}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Periodo siguiente"
          disabled={navYear >= currentYear}
          onClick={() => setNavYear(navYear + step)}
          className="shrink-0 self-center rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {overview ? (
        <>
          {/* Ingresos / Gastos / Neto */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-4xl font-bold" style={{ color: "#657280" }} data-testid="income">
                {formatMoney(overview.summary.income)}
              </p>
              <p className="text-sm font-medium" style={{ color: "#00C950" }}>
                Ingresos
              </p>
            </div>
            <div>
              <p className="text-4xl font-bold" style={{ color: "#657280" }} data-testid="expense">
                {formatMoney(overview.summary.expense)}
              </p>
              <p className="text-sm">
                <span className="font-medium" style={{ color: "#FE5A5C" }}>
                  Gastos
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · unos{" "}
                  {formatMoney(
                    Number(overview.summary.expense) /
                      daysElapsed(overview.date_from, overview.date_to),
                  )}
                  /día
                </span>
              </p>
            </div>
            <div>
              <p className="text-4xl font-bold" style={{ color: "#657280" }} data-testid="net">
                {formatMoney(overview.summary.net)}
              </p>
              <p className="text-sm text-muted-foreground">Neto ({overview.period_label})</p>
            </div>
          </div>

          {/* Cubos 50-30-20 */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Reparto {allocLabel}</h2>
              <Button size="sm" variant="outline" onClick={() => setBudgetOpen(true)}>
                Ajustar presupuesto
              </Button>
            </div>
            <div className="space-y-3">
              {overview.buckets.map((b) => (
                <div key={b.bucket}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-full", BUCKET_META[b.bucket].dot)} />
                      {b.label}
                    </span>
                    <span className="text-muted-foreground">
                      {formatMoney(b.spent)} / {formatMoney(b.budget)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        // Inversión siempre azul (pasarse invirtiendo no es malo).
                        b.bucket !== "investment" && STATUS_BAR[b.status],
                      )}
                      style={{
                        width: `${Math.min(100, b.pct)}%`,
                        ...(b.bucket === "investment" ? { backgroundColor: "#2B7FFF" } : {}),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Categorías: en el mes en curso, Gastado vs Previsto; si no, solo gasto */}
          <div>
            <h2 className="mb-2 font-semibold">
              {overview.is_current ? "Categorías: gastado vs previsto" : "Gastos por categoría"}
            </h2>
            {overview.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin gastos en este periodo.</p>
            ) : overview.is_current ? (
              <div className="max-h-[34rem] overflow-y-auto pr-2">
                <div className="flex items-center gap-3 border-b pb-1 text-xs text-muted-foreground">
                  <span className="w-6" />
                  <span className="flex-1">Categoría</span>
                  <span className="w-20 text-right">Gastado</span>
                  <span className="w-24 text-right">Previsto</span>
                  <span className="w-24 text-right">Balance</span>
                </div>
                <ul className="divide-y">
                  {overview.categories.map((c) => {
                    const id = c.category_id
                    const previstoStr = id ? (forecasts[id] ?? c.forecast ?? "") : ""
                    const overage = Number(c.spent) - (Number(previstoStr) || 0)
                    return (
                      <li key={id ?? "none"} className="flex items-center gap-3 py-3">
                        <span className="w-6 text-lg">{c.emoji ?? "🏷️"}</span>
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        <span className="w-20 text-right font-semibold">{formatMoney(c.spent)}</span>
                        <span className="w-24">
                          {id ? (
                            <span className="flex items-center rounded-md border px-2 py-1">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                aria-label={`Previsto de ${c.name}`}
                                className="w-full bg-transparent text-right text-sm outline-none"
                                placeholder="0"
                                value={previstoStr}
                                onChange={(e) => setForecastValue(id, e.target.value)}
                                onBlur={() => saveForecast(id)}
                              />
                              <span className="ml-0.5 text-muted-foreground">€</span>
                            </span>
                          ) : null}
                        </span>
                        <span className="w-24 text-right text-xs leading-tight">
                          {overage > 0 ? (
                            <span style={{ color: "#FE5A5C" }}>
                              {formatMoney(overage)}
                              <br />
                              Incrementado
                            </span>
                          ) : overage < 0 ? (
                            <span className="text-green-600">
                              {formatMoney(-overage)}
                              <br />
                              Ahorrado
                            </span>
                          ) : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <ul className="max-h-[34rem] space-y-5 overflow-y-auto pr-2">
                {overview.categories.map((c) => (
                  <li key={c.category_id ?? "none"} className="flex items-center gap-3">
                    <span className="w-6 text-lg">{c.emoji ?? "🏷️"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{c.name}</span>
                        <span className="font-semibold">{formatMoney(c.spent)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            c.bucket ? BUCKET_META[c.bucket].dot : "bg-gray-400",
                          )}
                          style={{ width: `${(Number(c.spent) / maxCatSpent) * 100}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-muted-foreground">Cargando…</p>
      )}

      <BudgetDialog
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        onSaved={() => void loadOverview()}
      />
    </main>
  )
}
