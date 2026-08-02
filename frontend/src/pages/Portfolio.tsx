import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Trash2 } from "lucide-react"

import { PortfolioHint } from "@/components/hints"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type Asset,
  type AssetClass,
  type AssetInput,
  type AssetKind,
  ApiError,
  type MonthAsset,
  api,
} from "@/lib/api"
import { formatMoney, todayISO } from "@/lib/format"
import { MAX_AMOUNT, withinCap } from "@/lib/money"

const CLASS_LABEL: Record<AssetClass, string> = { variable: "Renta variable", fija: "Renta fija" }
const KIND_LABEL: Record<AssetKind, string> = {
  etf: "ETF",
  fondo: "Fondo",
  accion: "Acción",
  cripto: "Cripto",
  otro: "Otro",
}

function monthKey(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export default function Portfolio() {
  const { year, month } = useMemo(monthKey, [])
  const [assets, setAssets] = useState<Asset[]>([])
  const [rows, setRows] = useState<MonthAsset[]>([])
  const [variablePct, setVariablePct] = useState(100)
  const [total, setTotal] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [assetDialog, setAssetDialog] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [alloc, monthRows] = await Promise.all([
        api.investment.getAllocation(),
        api.investment.month(year, month, total || "0"),
      ])
      setVariablePct(alloc.variable_pct)
      setRows(monthRows)
      setAssets(monthRows.map((r) => r.asset))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la cartera")
    } finally {
      setLoading(false)
    }
  }, [year, month, total])

  useEffect(() => {
    void load()
  }, [load])

  const saveAllocation = async (variable: number) => {
    setVariablePct(variable)
    await api.investment.setAllocation(variable, 100 - variable)
    await load()
  }

  const toggleDone = async (row: MonthAsset) => {
    setError(null)
    try {
      if (row.done) {
        await api.investment.undoContribution(row.asset.id, year, month)
      } else {
        // Usa el importe planificado; si es 0 (sin total), pide que se ponga uno.
        if (Number(row.planned) <= 0) {
          setError("Indica cuánto vas a invertir este mes para calcular el reparto")
          return
        }
        await api.investment.contribute(row.asset.id, row.planned, todayISO())
      }
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la aportación")
    }
  }

  const removeAsset = async (asset: Asset) => {
    await api.investment.deleteAsset(asset.id)
    await load()
  }

  const doneCount = rows.filter((r) => r.done).length
  const plannedTotal = rows.reduce((sum, r) => sum + Number(r.planned), 0)

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          Cartera
          <PortfolioHint />
        </h1>
        <Button
          onClick={() => {
            setEditing(null)
            setAssetDialog(true)
          }}
        >
          Añadir activo
        </Button>
      </header>

      {error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Cargando…</p>
      ) : assets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Aún no tienes activos.</p>
          <p>
            Añade tus ETFs, fondos o lo que tengas, dale un peso a cada uno y la app te
            calculará cuánto destinar a cada mes.
          </p>
        </div>
      ) : (
        <>
          {/* Reparto entre clases */}
          <section className="mb-6 rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Reparto por clase</h2>
              <span className="text-sm text-muted-foreground">
                {variablePct}% variable · {100 - variablePct}% fija
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={variablePct}
              aria-label="Porcentaje de renta variable"
              onChange={(e) => setVariablePct(Number(e.target.value))}
              onPointerUp={() => void saveAllocation(variablePct)}
              className="w-full accent-[var(--invest)]"
            />
          </section>

          {/* Calculadora del mes */}
          <section className="mb-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="total">A invertir este mes (€)</Label>
                <Input
                  id="total"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={MAX_AMOUNT}
                  step="0.01"
                  placeholder="p. ej. 1000"
                  value={total}
                  onChange={(e) => withinCap(e.target.value) && setTotal(e.target.value)}
                />
              </div>
              <p className="pb-2 text-sm text-muted-foreground">
                Reparte {formatMoney(plannedTotal)} · {doneCount}/{rows.length} hecho
              </p>
            </div>
          </section>

          {/* Checklist del mes */}
          <ul className="divide-y rounded-lg border">
            {rows.map((row) => (
              <li key={row.asset.id} className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  aria-label={row.done ? `Deshacer ${row.asset.name}` : `Marcar ${row.asset.name} como hecho`}
                  onClick={() => void toggleDone(row)}
                  className={
                    "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors " +
                    (row.done
                      ? "border-transparent bg-invest text-white"
                      : "hover:border-invest")
                  }
                >
                  {row.done ? <Check className="size-4" /> : null}
                </button>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        "size-2 shrink-0 rounded-full " +
                        (row.asset.asset_class === "variable" ? "bg-invest" : "bg-bucket-income")
                      }
                    />
                    <span className="truncate font-medium">{row.asset.name}</span>
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {CLASS_LABEL[row.asset.asset_class]} · {KIND_LABEL[row.asset.kind]} ·{" "}
                    {row.asset.weight}%
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block font-semibold tabular-nums">
                    {row.done ? formatMoney(row.contributed) : formatMoney(row.planned)}
                  </span>
                  {row.done ? (
                    <span className="text-xs text-invest">aportado</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">previsto</span>
                  )}
                </span>

                <button
                  type="button"
                  aria-label={`Editar ${row.asset.name}`}
                  onClick={() => {
                    setEditing(row.asset)
                    setAssetDialog(true)
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Editar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <AssetDialog
        open={assetDialog}
        asset={editing}
        onOpenChange={setAssetDialog}
        onSaved={() => {
          setAssetDialog(false)
          void load()
        }}
        onDelete={editing ? () => void removeAsset(editing) : undefined}
      />
    </main>
  )
}

function AssetDialog({
  open,
  asset,
  onOpenChange,
  onSaved,
  onDelete,
}: {
  open: boolean
  asset: Asset | null
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState("")
  const [assetClass, setAssetClass] = useState<AssetClass>("variable")
  const [kind, setKind] = useState<AssetKind>("etf")
  const [weight, setWeight] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(asset?.name ?? "")
    setAssetClass(asset?.asset_class ?? "variable")
    setKind(asset?.kind ?? "etf")
    setWeight(asset?.weight ?? "")
  }, [open, asset])

  const canSave = name.trim().length > 0 && Number(weight) >= 0 && !saving

  const submit = async () => {
    setSaving(true)
    setError(null)
    const input: AssetInput = {
      name: name.trim(),
      asset_class: assetClass,
      kind,
      weight: weight || "0",
    }
    try {
      if (asset) {
        await api.investment.updateAsset(asset.id, input)
      } else {
        await api.investment.createAsset(input)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el activo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asset ? "Editar activo" : "Nuevo activo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="asset-name">Nombre</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ETF MSCI World"
              maxLength={100}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="asset-class">Clase</Label>
              <Select value={assetClass} onValueChange={(v) => setAssetClass(v as AssetClass)}>
                <SelectTrigger id="asset-class" aria-label="Clase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["variable", "fija"] as AssetClass[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CLASS_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="asset-kind">Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as AssetKind)}>
                <SelectTrigger id="asset-kind" aria-label="Tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["etf", "fondo", "accion", "cripto", "otro"] as AssetKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="asset-weight">Peso dentro de su clase (%)</Label>
            <Input
              id="asset-weight"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="60"
            />
            <p className="text-xs text-muted-foreground">
              Los activos de una misma clase se reparten en proporción a su peso.
            </p>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-1 size-4" /> Borrar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={!canSave}>
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
