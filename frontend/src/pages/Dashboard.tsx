import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import {
  api,
  type AnalyticsOverview,
  type BucketStat,
  type Budget,
  type EmergencyFund,
  type SeriesPoint,
  type Transaction,
} from "@/lib/api"
import { amountClass, daysElapsed, formatMoney, signedAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

// Donut del mes: el aro es tu INGRESO; el rojo es lo GASTADO y el verde lo que
// te queda (neto). En el centro, el neto. Si gastas más de lo que ingresas, el
// aro se llena de rojo.
function NetDonut({
  income,
  expense,
  net,
  label,
}: {
  income: string
  expense: string
  net: string
  label: string
}) {
  const inc = Number(income)
  const exp = Number(expense)
  const size = 208
  const stroke = 18
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const mid = size / 2

  let redFrac = 0
  if (inc > 0) redFrac = Math.min(1, exp / inc)
  else if (exp > 0) redFrac = 1
  const greenFrac = 1 - redFrac
  const hasData = inc > 0 || exp > 0
  const negative = Number(net) < 0

  return (
    <div className="group relative mx-auto aspect-square w-52 max-w-full" title={`Ingresos ${formatMoney(income)} · Gastos ${formatMoney(expense)}`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full">
        <g transform={`rotate(-90 ${mid} ${mid})`} fill="none" strokeWidth={stroke}>
          {!hasData ? (
            <circle cx={mid} cy={mid} r={r} className="stroke-muted" />
          ) : (
            <>
              <circle
                cx={mid}
                cy={mid}
                r={r}
                stroke="#22c55e"
                strokeDasharray={`${greenFrac * c} ${c - greenFrac * c}`}
              />
              <circle
                cx={mid}
                cy={mid}
                r={r}
                stroke="#ef4444"
                strokeDasharray={`${redFrac * c} ${c - redFrac * c}`}
                strokeDashoffset={-greenFrac * c}
              />
            </>
          )}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn("whitespace-nowrap text-3xl font-bold", negative && "text-red-500")}
          data-testid="dash-net"
        >
          {formatMoney(net)}
        </span>
        <span className="px-4 text-center text-xs text-muted-foreground">Neto ({label})</span>
      </div>
      {/* Popup con el detalle al pasar el ratón */}
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-popover px-3 py-1.5 text-xs shadow-md group-hover:block">
        <span className="text-green-600">Ingresos {formatMoney(income)}</span>
        <span className="mx-1.5 text-muted-foreground">·</span>
        <span className="text-red-500">Gastos {formatMoney(expense)}</span>
      </div>
    </div>
  )
}

// Barras ingresos/gastos de los últimos meses (mismo estilo que Análisis).
// Al pulsar un mes se abre Análisis con ese mes seleccionado.
function MiniBars({
  series,
  onSelect,
}: {
  series: SeriesPoint[]
  onSelect: (p: SeriesPoint) => void
}) {
  const maxVal = useMemo(
    () => Math.max(1, ...series.flatMap((p) => [Number(p.income), Number(p.expense)])),
    [series],
  )
  return (
    <div className="flex items-end gap-2">
      {series.map((p) => (
        <button
          key={`${p.year}-${p.month}`}
          type="button"
          onClick={() => onSelect(p)}
          title={`Ver ${p.label} en Análisis`}
          className="flex flex-1 flex-col items-center gap-1 rounded-md py-1 transition-colors hover:bg-accent"
        >
          <div className="flex h-14 items-end gap-0.5">
            <div
              className="w-2 rounded-t bg-green-500"
              style={{ height: `${(Number(p.income) / maxVal) * 100}%` }}
            />
            <div
              className="w-2 rounded-t bg-red-500"
              style={{ height: `${(Number(p.expense) / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{p.label}</span>
        </button>
      ))}
    </div>
  )
}

type Tone = "good" | "warn" | "bad" | "info"

const TONE_STYLE: Record<Tone, string> = {
  good: "border-l-green-500",
  warn: "border-l-amber-500",
  bad: "border-l-red-500",
  info: "border-l-blue-500",
}

// Batería de mensajes por cubo y situación: cada cubo tiene su propia voz para
// que Vida y Mes no digan lo mismo, y varias variantes para que no sea repetitivo.
const MESSAGES = {
  living: {
    unset: "Configura tu ingreso mensual en Análisis para poder evaluar tus gastos de vida.",
    ok: [
      "Tus gastos esenciales están bien contenidos. Es la base de una economía sana: sigue así.",
      "Controlas muy bien lo que cuesta tu día a día. Ese margen es justo lo que te deja ahorrar.",
      "Tus gastos de vida van sobrados de presupuesto. Vas encaminado, mantén el rumbo.",
    ],
    warning: [
      "Tus gastos esenciales empiezan a apretar. Revisa suministros y compras para no pasarte.",
      "Estás cerca del tope en gastos de vida. Un pequeño ajuste ahora te evitará agobios a fin de mes.",
      "Ojo con lo esencial: se acerca al límite. Vigila la cesta de la compra estos días.",
    ],
    over: [
      "Te has pasado en gastos esenciales. Siéntate a revisar vivienda, suministros y compras con calma.",
      "Tus gastos de vida superan lo previsto. Prioriza lo imprescindible y busca dónde recortar.",
      "Alerta en gastos de vida: gastas más de lo que tu presupuesto permite. Reajusta cuanto antes.",
    ],
  },
  monthly: {
    unset: "Configura tu ingreso mensual en Análisis para poder evaluar tus gastos del mes.",
    ok: [
      "Tus caprichos y ocio están bajo control. Disfrutas sin desequilibrar tus cuentas, genial.",
      "Buen equilibrio en los gastos del mes: te das gustos sin comerte tu ahorro. ¡Bien hecho!",
      "Vas holgado con los gastos variables. Margen de sobra para lo que te apetezca.",
    ],
    warning: [
      "Los gastos del mes se acercan al límite. Modera algún capricho para llegar cómodo a fin de mes.",
      "Cuidado con el ocio y los extras: están apretando. Un respiro estos días te vendrá bien.",
      "Estás rozando el tope de gastos del mes. Quizá toque aparcar alguna compra no esencial.",
    ],
    over: [
      "Te has pasado con los gastos del mes. Los caprichos han pesado de más; frena un poco.",
      "Los gastos variables se han disparado. Aparca los extras hasta recuperar el equilibrio.",
      "Has superado tu presupuesto de ocio. Nada grave si lo corriges ya: baja el ritmo.",
    ],
  },
  investment: {
    active: [
      "Ya estás apartando dinero para invertir. Ese hábito, mes a mes, construye tu futuro.",
      "Bien por invertir este mes. El interés compuesto premia la constancia: no lo dejes.",
      "Estás cuidando a tu yo del futuro. Sigue sumando, aunque sea poco a poco.",
    ],
    idle: [
      "Aún no has invertido este mes. Apartar aunque sea una parte pequeña marca la diferencia a largo plazo.",
      "Todavía no hay inversión este mes. Tu futuro agradece cada euro que reserves hoy.",
      "No has destinado nada a invertir. Empezar pronto, aunque sea con poco, es tu mayor ventaja.",
    ],
  },
}

function pickByMonth(arr: string[]): string {
  return arr[new Date().getMonth() % arr.length]
}

function bucketMessage(b: BucketStat): { title: string; text: string; tone: Tone } {
  if (b.bucket === "investment") {
    const active = Number(b.spent) > 0
    return {
      title: "Inversión",
      tone: active ? "good" : "info",
      text: pickByMonth(active ? MESSAGES.investment.active : MESSAGES.investment.idle),
    }
  }
  const key = b.bucket === "living" ? "living" : "monthly"
  const title = key === "living" ? "Gastos de vida" : "Gastos del mes"
  if (Number(b.budget) === 0) {
    return { title, tone: "info", text: MESSAGES[key].unset }
  }
  const tone: Tone = b.status === "ok" ? "good" : b.status === "warning" ? "warn" : "bad"
  return { title, tone, text: pickByMonth(MESSAGES[key][b.status]) }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [budget, setBudget] = useState<Budget | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [recent, setRecent] = useState<Transaction[]>([])
  const [fund, setFund] = useState<EmergencyFund | null>(null)

  useEffect(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    void Promise.all([
      api.analytics.overview("month", year, month),
      api.budget.get(),
      api.analytics.recent(6),
      api.transactions.list({ size: 5 }),
      api.emergencyFund.get(),
    ]).then(([ov, bg, se, tx, ef]) => {
      setOverview(ov)
      setBudget(bg)
      setSeries(se)
      setRecent(tx)
      setFund(ef)
    })
  }, [])

  const pace = useMemo(() => {
    if (!overview || Number(overview.summary.expense) <= 0) return null
    const days = daysElapsed(overview.date_from, overview.date_to)
    const totalDays = Number(overview.date_to.slice(8, 10))
    const perDay = Number(overview.summary.expense) / days
    return { perDay, projection: perDay * totalDays }
  }, [overview])

  const allocLabel = budget
    ? `${budget.living_pct}-${budget.monthly_pct}-${budget.investment_pct}`
    : "50-30-20"

  const fundPct = fund ? Math.min(100, fund.pct) : 0

  if (!overview) {
    return <p className="py-8 text-center text-muted-foreground">Cargando…</p>
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Estado del mes: donut Neto */}
        <section className="rounded-xl border p-4 shadow-md lg:col-span-1">
          <h2 className="mb-3 font-semibold">Estado del mes</h2>
          <NetDonut
            income={overview.summary.income}
            expense={overview.summary.expense}
            net={overview.summary.net}
            label={overview.period_label}
          />
          {pace ? (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Gastas ~
              <span className="whitespace-nowrap font-medium text-foreground">
                {formatMoney(pace.perDay)}
              </span>
              /día · proyección fin de mes ~
              <span className="whitespace-nowrap font-medium text-foreground">
                {formatMoney(pace.projection)}
              </span>
            </p>
          ) : null}
        </section>

        {/* Mensajes 50-30-20 (título dinámico según el reparto configurado) */}
        <section className="flex flex-col rounded-xl border p-4 shadow-md lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Cómo llevas tu {allocLabel}</h2>
            <Link to="/analisis" className="text-sm text-blue-600 hover:underline">
              Ver análisis
            </Link>
          </div>
          <div className="flex flex-1 flex-col justify-around gap-3">
            {overview.buckets.map((b) => {
              const msg = bucketMessage(b)
              return (
                <div key={b.bucket} className={cn("border-l-4 pl-3", TONE_STYLE[msg.tone])}>
                  <p className="font-medium">{msg.title}</p>
                  <p className="text-[0.95rem] leading-snug text-muted-foreground">{msg.text}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Colchón de emergencia */}
        <section className="rounded-xl border p-4 shadow-md lg:col-span-1">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Colchón de emergencia</h2>
            <Link to="/colchon" className="text-sm text-blue-600 hover:underline">
              Ver detalle
            </Link>
          </div>
          {fund ? (
            <Link to="/colchon" className="block">
              <p className="text-2xl font-bold">{formatMoney(fund.saved)}</p>
              <p className="mb-2 text-sm text-muted-foreground">
                de {formatMoney(fund.target)} ({fund.target_months} meses)
              </p>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    fund.pct >= 100 ? "bg-green-500" : "bg-blue-500",
                  )}
                  style={{ width: `${fundPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {fund.pct >= 100 ? "¡Objetivo alcanzado!" : `Te faltan ${formatMoney(fund.remaining)}`}
              </p>
            </Link>
          ) : null}
        </section>

        {/* Últimos 3 movimientos */}
        <section className="rounded-xl border p-4 shadow-md lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Últimos movimientos</h2>
            <Link to="/movimientos" className="text-sm text-blue-600 hover:underline">
              Ver todos
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay movimientos.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="text-lg">{t.category?.emoji ?? "🏷️"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.concept}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.category?.name ?? "Sin categoría"} · {t.occurred_on}
                    </p>
                  </div>
                  <span className={cn("text-sm font-semibold", amountClass(t.type))}>
                    {signedAmount(t.amount, t.type)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Resumen 6 meses */}
        <section className="rounded-xl border p-4 shadow-md lg:col-span-3">
          <h2 className="mb-3 font-semibold">Últimos 6 meses</h2>
          {series.length > 0 ? (
            <MiniBars
              series={series}
              onSelect={(p) =>
                navigate(`/analisis?granularity=month&year=${p.year}&month=${p.month}`)
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          )}
        </section>
      </div>
    </main>
  )
}
