import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

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
  const [granularity, setGranularity] = useState<Granularity>("month")
  const [sel, setSel] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [budgetOpen, setBudgetOpen] = useState(false)

  const load = useCallback(async () => {
    const [ov, sr] = await Promise.all([
      api.analytics.overview(granularity, sel.year, sel.month),
      api.analytics.series(granularity, granularity === "year" ? 6 : 12),
    ])
    setOverview(ov)
    setSeries(sr)
  }, [granularity, sel])

  useEffect(() => {
    void load()
  }, [load])

  const switchGranularity = (g: Granularity) => {
    setGranularity(g)
    setSel({ year: today.getFullYear(), month: today.getMonth() + 1 })
  }

  const maxVal = useMemo(
    () => Math.max(1, ...series.flatMap((p) => [Number(p.income), Number(p.expense)])),
    [series],
  )

  const isSelected = (p: SeriesPoint) =>
    p.year === sel.year && (granularity === "year" || p.month === sel.month)

  const maxCatSpent = overview
    ? Math.max(1, ...overview.categories.map((c) => Number(c.spent)))
    : 1

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
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

      {/* Navegador con mini-barras ingresos/gastos */}
      <div className="mb-6 flex items-end gap-2 overflow-x-auto border-b pb-2" data-testid="navigator">
        {series.map((p) => (
          <button
            key={`${p.year}-${p.month ?? "y"}`}
            type="button"
            onClick={() => setSel({ year: p.year, month: p.month ?? 1 })}
            className="flex shrink-0 flex-col items-center gap-1"
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

      {overview ? (
        <>
          {/* Ingresos / Gastos / Neto */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-4xl font-bold text-green-600" data-testid="income">
                {formatMoney(overview.summary.income)}
              </p>
              <p className="text-sm text-muted-foreground">Ingresos</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-red-600" data-testid="expense">
                {formatMoney(overview.summary.expense)}
              </p>
              <p className="text-sm text-muted-foreground">
                Gastos · unos{" "}
                {formatMoney(
                  Number(overview.summary.expense) /
                    daysElapsed(overview.date_from, overview.date_to),
                )}
                /día
              </p>
            </div>
            <div>
              <p className="text-4xl font-bold" data-testid="net">
                {formatMoney(overview.summary.net)}
              </p>
              <p className="text-sm text-muted-foreground">Neto ({overview.period_label})</p>
            </div>
          </div>

          {/* Cubos 50-30-20 */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Reparto 50-30-20</h2>
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
                      className={cn("h-full rounded-full", STATUS_BAR[b.status])}
                      style={{ width: `${Math.min(100, b.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desglose por categoría */}
          <div>
            <h2 className="mb-2 font-semibold">Gastos por categoría</h2>
            {overview.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin gastos en este periodo.</p>
            ) : (
              <ul className="space-y-2">
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

      <BudgetDialog open={budgetOpen} onOpenChange={setBudgetOpen} onSaved={() => void load()} />
    </main>
  )
}
