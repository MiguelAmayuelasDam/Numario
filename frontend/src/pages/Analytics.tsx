import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
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
import { Rule503020Hint } from "@/components/hints"
import {
  type AmountSizes,
  BUCKET_META,
  amountSizeClass,
  daysElapsed,
  formatMoney,
} from "@/lib/format"

// Columna de ~277 px (un tercio de max-w-4xl). Cae hasta text-2xl para que
// "9.999.999,00 €" no se toque con la cifra de al lado.
const HERO_SIZES: AmountSizes = ["text-4xl", "text-3xl", "text-2xl"]
import { MAX_AMOUNT, withinCap } from "@/lib/money"
import { cn } from "@/lib/utils"

const STATUS_BAR: Record<BucketStat["status"], string> = {
  // Sin ingreso configurado la barra ni siquiera se pinta (ancho 0); el color da
  // igual, pero el tipo obliga a declararlo y así queda explícito.
  unset: "bg-muted",
  ok: "bg-income",
  warning: "bg-bucket-amber",
  over: "bg-expense",
}

type Pcts = { living_pct: number; monthly_pct: number; investment_pct: number }

function BudgetDialog({
  open,
  onOpenChange,
  onSaved,
  granularity,
  year,
  month,
  periodLabel,
  incomeBase,
  suggested,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  granularity: Granularity
  year: number
  month: number
  periodLabel: string
  incomeBase: string
  /** El ingreso que llega es una propuesta deducida de los movimientos, no algo
   *  que el usuario haya configurado: hay que decírselo. */
  suggested: boolean
}) {
  const [pcts, setPcts] = useState<Pcts>({ living_pct: 50, monthly_pct: 30, investment_pct: 20 })
  const [income, setIncome] = useState("")
  const [setAsDefault, setSetAsDefault] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const isMonth = granularity === "month"

  useEffect(() => {
    if (!open) return
    setError(null)
    // Si no tenía ingreso configurado, marcarlo por defecto: así un solo Guardar
    // deja listos **todos** los meses (el habitual es el que rellena los huecos)
    // y no solo este. Sin esto, el usuario arregla julio y vuelve a encontrarse
    // las barras vacías en agosto. Quien ya lo tiene puesto decide él.
    setSetAsDefault(suggested)
    setIncome(incomeBase)
    setLoaded(false)
    api.budget
      .get()
      .then((b) => {
        setPcts({
          living_pct: b.living_pct,
          monthly_pct: b.monthly_pct,
          investment_pct: b.investment_pct,
        })
      })
      .finally(() => setLoaded(true))
  }, [open, incomeBase, suggested])

  if (!open || !loaded) return null

  const sum = pcts.living_pct + pcts.monthly_pct + pcts.investment_pct
  const incomeValid = !isMonth || (income !== "" && Number(income) >= 0)
  const canSave = sum === 100 && incomeValid && !saving

  const save = async () => {
    setSaving(true)
    setError(null)
    const amount = income === "" ? "0" : income
    try {
      if (isMonth) {
        await api.budget.setIncome(year, month, amount)
      }
      await api.budget.update({
        ...pcts,
        ...(isMonth && setAsDefault ? { monthly_income: amount } : {}),
      })
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  const pctField = (key: keyof Pcts, label: string) => (
    <div className="space-y-1">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min="0"
        max="100"
        value={pcts[key]}
        onChange={(e) => setPcts({ ...pcts, [key]: Number(e.target.value) })}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            Ajustar presupuesto
            <Rule503020Hint />
          </DialogTitle>
          <DialogDescription>
            {isMonth
              ? `Ingreso de ${periodLabel} y el reparto 50-30-20 (los porcentajes deben sumar 100).`
              : "El ingreso se ajusta mes a mes; aquí solo el reparto 50-30-20 (debe sumar 100)."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {isMonth ? (
            <div className="space-y-1">
              <Label htmlFor="income">Ingreso de {periodLabel} (€)</Label>
              {suggested ? (
                <p className="text-xs text-muted-foreground">
                  Te proponemos lo que has ingresado este periodo. Cámbialo si tu ingreso
                  habitual es otro.
                </p>
              ) : null}
              <Input
                id="income"
                type="number"
                min="0"
                max={MAX_AMOUNT}
                step="0.01"
                value={income}
                onChange={(e) => withinCap(e.target.value) && setIncome(e.target.value)}
              />
              <label className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                />
                Usar también como ingreso habitual
              </label>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Ingreso {periodLabel} (suma de los 12 meses)</Label>
              <p className="rounded-md border bg-muted px-3 py-2 text-sm font-semibold">
                {formatMoney(incomeBase)}
              </p>
              <p className="text-xs text-muted-foreground">
                El ingreso se ajusta mes a mes desde la vista de Meses.
              </p>
            </div>
          )}
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
  const [searchParams] = useSearchParams()

  // Periodo inicial: si se llega con ?year&month (p. ej. desde el dashboard),
  // se abre en ese periodo; si no, en el mes actual.
  const pYear = Number(searchParams.get("year"))
  const pMonth = Number(searchParams.get("month"))
  const initGranularity: Granularity = searchParams.get("granularity") === "year" ? "year" : "month"
  const initYear = pYear >= 2000 && pYear <= 2100 ? pYear : currentYear
  const initMonth = pMonth >= 1 && pMonth <= 12 ? pMonth : today.getMonth() + 1

  const [granularity, setGranularity] = useState<Granularity>(initGranularity)
  const [sel, setSel] = useState({ year: initYear, month: initMonth })
  const [navYear, setNavYear] = useState(initYear) // año-ancla del navegador
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
    void api.forecast.set(id, v && v !== "" ? v : "0").catch(() => { })
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

  // Sin ingreso configurado no hay presupuesto y el semáforo no puede opinar.
  const noIncome = Number(overview?.income_base ?? 0) <= 0

  // Qué proponer en el diálogo. Si ya hay un ingreso configurado, ese. Si no, el
  // que se deduce de los movimientos del periodo: se lo enseñamos ya escrito
  // para que solo tenga que confirmarlo, pero **decide él**. Ponerlo por su
  // cuenta convertiría el plan en un reflejo de lo ya gastado, y entonces el
  // semáforo nunca podría decirle que se está pasando.
  const suggestedIncome = noIncome ? (overview?.summary.income ?? "0") : (overview?.income_base ?? "0")

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8" style={{ zoom: 1.1 }}>
      <h1 className="mb-4 text-3xl font-bold">Análisis</h1>

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
                  className="w-2 rounded-t bg-income"
                  style={{ height: `${(Number(p.income) / maxVal) * 100}%` }}
                />
                <div
                  className="w-2 rounded-t bg-expense"
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
              <p
                className={cn(
                  "font-bold tracking-tight",
                  amountSizeClass(formatMoney(overview.summary.income), HERO_SIZES),
                )}
                style={{ color: "var(--foreground)" }}
                data-testid="income"
              >
                {formatMoney(overview.summary.income)}
              </p>
              <p className="text-sm font-medium" style={{ color: "var(--income)" }}>
                Ingresos
              </p>
            </div>
            <div>
              <p
                className={cn(
                  "font-bold tracking-tight",
                  amountSizeClass(formatMoney(overview.summary.expense), HERO_SIZES),
                )}
                style={{ color: "var(--foreground)" }}
                data-testid="expense"
              >
                {formatMoney(overview.summary.expense)}
              </p>
              <p className="text-sm">
                <span className="font-medium" style={{ color: "var(--expense)" }}>
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
              <p
                className={cn(
                  "font-bold tracking-tight",
                  amountSizeClass(formatMoney(overview.summary.net), HERO_SIZES),
                )}
                style={{ color: "var(--foreground)" }}
                data-testid="net"
              >
                {formatMoney(overview.summary.net)}
              </p>
              <p className="text-sm text-muted-foreground">Neto ({overview.period_label})</p>
            </div>
          </div>

          {/* Cubos 50-30-20 */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 font-semibold">
                Reparto {allocLabel}
                <Rule503020Hint />
              </h2>
              <Button size="sm" variant="outline" onClick={() => setBudgetOpen(true)}>
                Ajustar presupuesto
              </Button>
            </div>
            {noIncome ? (
              <div
                className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3"
                data-testid="no-income"
              >
                <p className="text-sm text-muted-foreground">
                  Sin tu ingreso de {overview.period_label} no hay con qué comparar tus gastos.
                </p>
                <Button size="sm" onClick={() => setBudgetOpen(true)}>
                  Configurar ingreso
                </Button>
              </div>
            ) : null}
            <div className="space-y-3">
              {overview.buckets.map((b) => (
                <div key={b.bucket}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-full", BUCKET_META[b.bucket].dot)} />
                      {b.label}
                    </span>
                    {b.status === "unset" ? (
                      // No decimos "0,00 € / 0,00 €", que se lee como "no has
                      // gastado nada": lo gastado sí lo sabemos, el límite no.
                      <span className="text-muted-foreground">
                        {formatMoney(b.spent)} <span className="opacity-70">· sin límite fijado</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {formatMoney(b.spent)} / {formatMoney(b.budget)}
                      </span>
                    )}
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
                        ...(b.bucket === "investment" ? { backgroundColor: "var(--invest)" } : {}),
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
                  <span className="w-28 shrink-0 text-right">Gastado</span>
                  <span className="w-24 shrink-0 text-right">Previsto</span>
                  <span className="w-28 shrink-0 text-right">Balance</span>
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
                        <span className="w-28 shrink-0 whitespace-nowrap text-right font-semibold">
                          {formatMoney(c.spent)}
                        </span>
                        <span className="w-24 shrink-0">
                          {id ? (
                            <span className="flex items-center rounded-md border px-2 py-1">
                              <input
                                type="number"
                                min="0"
                                max={MAX_AMOUNT}
                                step="0.01"
                                aria-label={`Previsto de ${c.name}`}
                                className="w-full bg-transparent text-right text-sm outline-none"
                                placeholder="0"
                                value={previstoStr}
                                onChange={(e) =>
                                  withinCap(e.target.value) && setForecastValue(id, e.target.value)
                                }
                                onBlur={() => saveForecast(id)}
                              />
                              <span className="ml-0.5 text-muted-foreground">€</span>
                            </span>
                          ) : null}
                        </span>
                        <span className="w-28 shrink-0 whitespace-nowrap text-right text-xs leading-tight">
                          {overage > 0 ? (
                            <span style={{ color: "var(--expense)" }}>
                              {formatMoney(overage)}
                              <br />
                              Incrementado
                            </span>
                          ) : overage < 0 ? (
                            <span className="text-income">
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
                            c.bucket ? BUCKET_META[c.bucket].dot : "bg-bucket-transfer",
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
        granularity={granularity}
        year={sel.year}
        month={sel.month}
        periodLabel={overview?.period_label ?? ""}
        incomeBase={suggestedIncome}
        suggested={noIncome}
      />
    </main>
  )
}
