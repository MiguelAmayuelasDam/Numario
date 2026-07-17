import { useCallback, useEffect, useState } from "react"
import { Trash2 } from "lucide-react"

import { EmergencyFundHint } from "@/components/hints"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, api, type EmergencyFund } from "@/lib/api"
import { formatMoney, formatDateHeader, todayISO } from "@/lib/format"
import { MAX_AMOUNT, withinCap } from "@/lib/money"

function AddContributionDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount("")
      setDate(todayISO())
      setError(null)
    }
  }, [open])

  const canSave = Number(amount) > 0 && date !== "" && !saving

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.emergencyFund.addContribution(amount, date)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir monto al colchón</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ef-amount">Cantidad (€)</Label>
            <Input
              id="ef-amount"
              type="number"
              inputMode="decimal"
              min="0"
              max={MAX_AMOUNT}
              step="0.01"
              value={amount}
              onChange={(e) => withinCap(e.target.value) && setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha</Label>
            <DatePicker
              value={date}
              onChange={setDate}
              max={todayISO()}
              placeholder="Elige una fecha"
              aria-label="Fecha de la aportación"
              className="w-full"
            />
          </div>
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
            Añadir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function EmergencyFundPage() {
  const [fund, setFund] = useState<EmergencyFund | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [need, setNeed] = useState("")
  const [savingNeed, setSavingNeed] = useState(false)

  const load = useCallback(async () => {
    const data = await api.emergencyFund.get()
    setFund(data)
    setNeed(data.monthly_need)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const changeMonths = async (months: number) => {
    const data = await api.emergencyFund.setTarget(months)
    setFund(data)
    setNeed(data.monthly_need)
  }

  const saveNeed = async () => {
    if (need === "" || !withinCap(need)) return
    setSavingNeed(true)
    try {
      const data = await api.emergencyFund.setMonthlyNeed(need)
      setFund(data)
      setNeed(data.monthly_need)
    } finally {
      setSavingNeed(false)
    }
  }

  const remove = async (id: string) => {
    await api.emergencyFund.deleteContribution(id)
    void load()
  }

  const pct = fund ? Math.min(100, fund.pct) : 0
  const reached = fund ? fund.pct >= 100 : false
  const needChanged = fund ? need !== fund.monthly_need : false

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="mb-6 flex items-center gap-2 text-3xl font-bold">
        Colchón de emergencia
        <EmergencyFundHint />
      </h1>

      {!fund ? (
        <p className="py-8 text-center text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {/* Sin objetivo definido (usuario nuevo): el hueco de "0 € de 0 €" no
              dice nada, así que se aprovecha para explicar qué es un colchón —
              sin competir con ningún dato, porque todavía no lo hay. */}
          {Number(fund.target) <= 0 ? (
            <div
              className="mb-6 space-y-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
              data-testid="ef-empty"
            >
              <p className="font-medium text-foreground">Aún no tienes un colchón definido.</p>
              <p>
                Un colchón de emergencia es un ahorro para los imprevistos —una avería,
                quedarte sin trabajo— que convierte un susto en una molestia en vez de en un
                problema. Lo habitual es cubrir de 3 a 6 meses de tus gastos de vida.
              </p>
              <p>Di abajo cuánto necesitas para vivir al mes y empieza a sumar.</p>
            </div>
          ) : null}

          {/* Cantidad ahorrada en grande */}
          <div className="mb-2 text-center">
            <p className="text-5xl font-bold" data-testid="ef-saved">
              {formatMoney(fund.saved)}
            </p>
            <p className="mt-1 text-muted-foreground">de {formatMoney(fund.target)} objetivo</p>
          </div>

          {/* Barra de progreso + lo que falta */}
          <div className="mb-2 h-4 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${reached ? "bg-income" : "bg-invest"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mb-6 text-center text-sm">
            {reached ? (
              <span className="font-medium text-income">
                ¡Objetivo alcanzado! Tienes tu colchón completo.
              </span>
            ) : (
              <span className="text-muted-foreground">
                Te faltan{" "}
                <span className="font-semibold text-foreground">{formatMoney(fund.remaining)}</span>{" "}
                ({pct}% completado)
              </span>
            )}
          </p>

          {/* Objetivo configurable: gasto mensual + meses */}
          <div className="mb-6 space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="ef-need">Gasto mensual para vivir (€)</Label>
                <Input
                  id="ef-need"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={MAX_AMOUNT}
                  step="0.01"
                  value={need}
                  onChange={(e) => withinCap(e.target.value) && setNeed(e.target.value)}
                />
              </div>
              <Button onClick={() => void saveNeed()} disabled={!needChanged || savingNeed}>
                Guardar
              </Button>
              <div className="space-y-1">
                <Label htmlFor="ef-months">Meses</Label>
                <select
                  id="ef-months"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={fund.target_months}
                  onChange={(e) => void changeMonths(Number(e.target.value))}
                >
                  {[3, 4, 5, 6].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Objetivo: {fund.target_months} meses × {formatMoney(fund.monthly_need)}/mes ={" "}
              <span className="font-semibold text-foreground">{formatMoney(fund.target)}</span>. Se
              recomienda cubrir de 3 a 6 meses de tu gasto mensual.
            </p>
          </div>

          {/* Añadir monto */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Aportaciones</h2>
            <Button onClick={() => setAddOpen(true)}>Añadir monto</Button>
          </div>

          {/* Listado de aportaciones */}
          {fund.contributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no has aportado nada. Empieza con tu primer monto.
            </p>
          ) : (
            <ul className="divide-y">
              {fund.contributions.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">
                    {formatDateHeader(c.occurred_on)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-income">+{formatMoney(c.amount)}</span>
                    <button
                      type="button"
                      aria-label="Borrar aportación"
                      onClick={() => void remove(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <AddContributionDialog open={addOpen} onOpenChange={setAddOpen} onSaved={() => void load()} />
    </main>
  )
}
