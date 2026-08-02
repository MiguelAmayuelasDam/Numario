import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Trash2 } from "lucide-react"

import { PortfolioHint } from "@/components/hints"
import { PortfolioDonut } from "@/components/PortfolioDonut"
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
  type GroupInput,
  type InvestmentGroup,
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
const NO_GROUP = "none"

function monthKey(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

/** Suma de pesos que debería dar 100; se usa para avisar si el reparto no cierra. */
function weightSum(weights: string[]): number {
  return weights.reduce((s, w) => s + Number(w), 0)
}

/**
 * Peso (%) con **barra deslizable + campo editable**: se arrastra para lo grueso
 * y se teclea el valor exacto con hasta dos decimales (p. ej. 20,22). Ambos van
 * topados al margen disponible (`max`) para no superar el 100% entre hermanos.
 */
function WeightSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: string
  max: number
  onChange: (v: string) => void
}) {
  const num = Number(value) || 0
  const sliderValue = Math.min(num, max) // el range necesita un número ≤ max

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={max}
            step="0.01"
            value={value}
            aria-label="Peso exacto"
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-20 px-2 py-0 text-right text-sm tabular-nums"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={0.01}
        value={sliderValue}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-[var(--invest)]"
      />
      <p className="text-xs text-muted-foreground">
        {max >= 100 ? "Hasta 100%." : `Tope: ${round2(max)}% (lo que queda libre).`}
      </p>
    </div>
  )
}

/** Redondea a 2 decimales, para que el margen no arrastre errores de coma flotante. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Margen libre para un activo dentro de su padre (grupo o clase), excluyéndose. */
function assetRoom(
  assets: Asset[],
  groupId: string | null,
  assetClass: AssetClass,
  selfId: string | undefined,
): number {
  const siblings = assets.filter((a) => {
    if (a.id === selfId) return false
    return groupId ? a.group_id === groupId : a.asset_class === assetClass && !a.group_id
  })
  return round2(Math.max(0, 100 - siblings.reduce((s, a) => s + Number(a.weight), 0)))
}

/** Margen libre para un grupo dentro de su clase, excluyéndose. */
function groupRoom(
  groups: InvestmentGroup[],
  assetClass: AssetClass,
  selfId: string | undefined,
): number {
  const siblings = groups.filter((g) => g.id !== selfId && g.asset_class === assetClass)
  return round2(Math.max(0, 100 - siblings.reduce((s, g) => s + Number(g.weight), 0)))
}

export default function Portfolio() {
  const { year, month } = useMemo(monthKey, [])
  const [rows, setRows] = useState<MonthAsset[]>([])
  const [groups, setGroups] = useState<InvestmentGroup[]>([])
  const [variablePct, setVariablePct] = useState(100)
  const [total, setTotal] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [assetDialog, setAssetDialog] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [groupDialog, setGroupDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<InvestmentGroup | null>(null)

  // El total se lee por ref para que recargar la estructura NO dependa de él: si
  // dependiera, cada tecla recrearía `load`, dispararía el spinner y desmontaría
  // el input de "a invertir" (que perdía el foco a cada pulsación).
  const totalRef = useRef(total)
  totalRef.current = total

  const load = useCallback(
    async (spinner = false) => {
      if (spinner) setLoading(true)
      try {
        const [alloc, grps, monthRows] = await Promise.all([
          api.investment.getAllocation(),
          api.investment.listGroups(),
          api.investment.month(year, month, totalRef.current || "0"),
        ])
        setVariablePct(alloc.variable_pct)
        setGroups(grps)
        setRows(monthRows)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "No se pudo cargar la cartera")
      } finally {
        if (spinner) setLoading(false)
      }
    },
    [year, month],
  )

  // Carga inicial (con spinner).
  useEffect(() => {
    void load(true)
  }, [load])

  // Al cambiar el total, solo se recalcula el reparto (los importes), sin spinner
  // y con un pequeño retardo, para no desmontar nada ni machacar la API.
  useEffect(() => {
    const id = setTimeout(() => {
      api.investment
        .month(year, month, total || "0")
        .then(setRows)
        .catch(() => {})
    }, 250)
    return () => clearTimeout(id)
  }, [total, year, month])

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
  const removeGroup = async (group: InvestmentGroup) => {
    await api.investment.deleteGroup(group.id)
    await load()
  }

  const doneCount = rows.filter((r) => r.done).length
  const plannedTotal = rows.reduce((sum, r) => sum + Number(r.planned), 0)
  const hasContent = rows.length > 0 || groups.length > 0
  const assets = useMemo(() => rows.map((r) => r.asset), [rows])

  // Estructura en árbol para pintar: por clase, sus grupos y sus activos sueltos.
  const tree = useMemo(() => {
    return (["variable", "fija"] as AssetClass[])
      .map((cls) => {
        const clsGroups = groups
          .filter((g) => g.asset_class === cls)
          .map((g) => ({ group: g, rows: rows.filter((r) => r.asset.group_id === g.id) }))
        const loose = rows.filter((r) => r.asset.asset_class === cls && !r.asset.group_id)
        return { cls, groups: clsGroups, loose }
      })
      .filter((c) => c.groups.length > 0 || c.loose.length > 0)
  }, [rows, groups])

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          Cartera
          <PortfolioHint />
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditingGroup(null)
              setGroupDialog(true)
            }}
          >
            Añadir grupo
          </Button>
          <Button
            onClick={() => {
              setEditingAsset(null)
              setAssetDialog(true)
            }}
          >
            Añadir activo
          </Button>
        </div>
      </header>

      {error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Cargando…</p>
      ) : !hasContent ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Aún no tienes cartera.</p>
          <p>
            Crea grupos (por ejemplo «Crecimiento» y «Dividendos» dentro de renta variable) o
            añade activos sueltos, dales un peso, y la app calculará cuánto destinar a cada mes.
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

          {/* Gráfico del reparto por activo */}
          {assets.length > 0 ? (
            <section className="mb-6 rounded-lg border p-4">
              <h2 className="mb-3 font-semibold">Reparto por activo</h2>
              <PortfolioDonut assets={assets} groups={groups} variablePct={variablePct} />
            </section>
          ) : null}

          {/* Árbol: clase → grupos → activos */}
          <div className="space-y-5">
            {tree.map(({ cls, groups: clsGroups, loose }) => (
              <section key={cls}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CLASS_LABEL[cls]}
                </h3>

                {clsGroups.map(({ group, rows: groupRows }) => (
                  <div key={group.id} className="mb-3 rounded-lg border">
                    <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                      <span className="text-sm font-medium">
                        {group.name}{" "}
                        <span className="text-muted-foreground">· {Number(group.weight)}%</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            setEditingGroup(group)
                            setGroupDialog(true)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          aria-label={`Borrar grupo ${group.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => void removeGroup(group)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </span>
                    </div>
                    {groupRows.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Sin activos en este grupo.
                      </p>
                    ) : (
                      <AssetRows
                        rows={groupRows}
                        onToggle={toggleDone}
                        onEdit={(a) => {
                          setEditingAsset(a)
                          setAssetDialog(true)
                        }}
                      />
                    )}
                    {group.weight && weightSum(groupRows.map((r) => r.asset.weight)) !== 100 ? (
                      <p className="px-3 py-1.5 text-xs text-bucket-amber">
                        Los pesos de este grupo suman{" "}
                        {weightSum(groupRows.map((r) => r.asset.weight))}%, no 100%.
                      </p>
                    ) : null}
                  </div>
                ))}

                {loose.length > 0 ? (
                  <div className="rounded-lg border">
                    <AssetRows
                      rows={loose}
                      onToggle={toggleDone}
                      onEdit={(a) => {
                        setEditingAsset(a)
                        setAssetDialog(true)
                      }}
                    />
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </>
      )}

      <AssetDialog
        open={assetDialog}
        asset={editingAsset}
        groups={groups}
        assets={assets}
        onOpenChange={setAssetDialog}
        onSaved={() => {
          setAssetDialog(false)
          void load()
        }}
        onDelete={editingAsset ? () => void removeAsset(editingAsset) : undefined}
      />
      <GroupDialog
        open={groupDialog}
        group={editingGroup}
        groups={groups}
        onOpenChange={setGroupDialog}
        onSaved={() => {
          setGroupDialog(false)
          void load()
        }}
      />
    </main>
  )
}

function AssetRows({
  rows,
  onToggle,
  onEdit,
}: {
  rows: MonthAsset[]
  onToggle: (r: MonthAsset) => void
  onEdit: (a: Asset) => void
}) {
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.asset.id} className="flex items-center gap-3 p-3">
          <button
            type="button"
            aria-label={
              row.done ? `Deshacer ${row.asset.name}` : `Marcar ${row.asset.name} como hecho`
            }
            onClick={() => onToggle(row)}
            className={
              "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors " +
              (row.done ? "border-transparent bg-invest text-white" : "hover:border-invest")
            }
          >
            {row.done ? <Check className="size-4" /> : null}
          </button>

          <span className="min-w-0 flex-1">
            <span className="truncate font-medium">{row.asset.name}</span>
            <span className="block truncate text-sm text-muted-foreground">
              {KIND_LABEL[row.asset.kind]} · {Number(row.asset.weight)}%
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span className="block font-semibold tabular-nums">
              {row.done ? formatMoney(row.contributed) : formatMoney(row.planned)}
            </span>
            <span className={"text-xs " + (row.done ? "text-invest" : "text-muted-foreground")}>
              {row.done ? "aportado" : "previsto"}
            </span>
          </span>

          <button
            type="button"
            aria-label={`Editar ${row.asset.name}`}
            onClick={() => onEdit(row.asset)}
            className="text-sm text-primary hover:underline"
          >
            Editar
          </button>
        </li>
      ))}
    </ul>
  )
}

function GroupDialog({
  open,
  group,
  groups,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  group: InvestmentGroup | null
  groups: InvestmentGroup[]
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [assetClass, setAssetClass] = useState<AssetClass>("variable")
  const [weight, setWeight] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(group?.name ?? "")
    setAssetClass(group?.asset_class ?? "variable")
    setWeight(group?.weight ?? "")
  }, [open, group])

  const submit = async () => {
    setSaving(true)
    setError(null)
    const input: GroupInput = { name: name.trim(), asset_class: assetClass, weight: weight || "0" }
    try {
      if (group) await api.investment.updateGroup(group.id, input)
      else await api.investment.createGroup(input)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el grupo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? "Editar grupo" : "Nuevo grupo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="group-name">Nombre</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Crecimiento"
              maxLength={100}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="group-class">Clase</Label>
            <Select value={assetClass} onValueChange={(v) => setAssetClass(v as AssetClass)}>
              <SelectTrigger id="group-class" aria-label="Clase del grupo">
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
          <WeightSlider
            label="Peso en su clase"
            value={weight}
            max={groupRoom(groups, assetClass, group?.id)}
            onChange={setWeight}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!name.trim() || saving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssetDialog({
  open,
  asset,
  groups,
  assets,
  onOpenChange,
  onSaved,
  onDelete,
}: {
  open: boolean
  asset: Asset | null
  groups: InvestmentGroup[]
  assets: Asset[]
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState("")
  const [assetClass, setAssetClass] = useState<AssetClass>("variable")
  const [kind, setKind] = useState<AssetKind>("etf")
  const [weight, setWeight] = useState("")
  const [groupId, setGroupId] = useState<string>(NO_GROUP)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(asset?.name ?? "")
    setAssetClass(asset?.asset_class ?? "variable")
    setKind(asset?.kind ?? "etf")
    setWeight(asset?.weight ?? "")
    setGroupId(asset?.group_id ?? NO_GROUP)
  }, [open, asset])

  // Si el activo está en un grupo, su clase la manda el grupo.
  const groupClass = groupId !== NO_GROUP ? groups.find((g) => g.id === groupId)?.asset_class : null
  const effectiveClass = groupClass ?? assetClass

  const submit = async () => {
    setSaving(true)
    setError(null)
    const input: AssetInput = {
      name: name.trim(),
      asset_class: effectiveClass,
      kind,
      weight: weight || "0",
      group_id: groupId === NO_GROUP ? null : groupId,
    }
    try {
      if (asset) await api.investment.updateAsset(asset.id, input)
      else await api.investment.createAsset(input)
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
          <div className="space-y-1">
            <Label htmlFor="asset-group">Grupo</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger id="asset-group" aria-label="Grupo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GROUP}>Sin grupo (cuelga de la clase)</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} · {CLASS_LABEL[g.asset_class]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="asset-class">Clase</Label>
              <Select
                value={effectiveClass}
                onValueChange={(v) => setAssetClass(v as AssetClass)}
                disabled={groupClass !== null}
              >
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
          <WeightSlider
            label={`Peso dentro de su ${groupClass !== null ? "grupo" : "clase"}`}
            value={weight}
            max={assetRoom(assets, groupId === NO_GROUP ? null : groupId, effectiveClass, asset?.id)}
            onChange={setWeight}
          />
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
            <Button type="button" onClick={() => void submit()} disabled={!name.trim() || saving}>
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
