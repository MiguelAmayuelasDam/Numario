import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Check, Trash2 } from "lucide-react"

import { ContributionDialog } from "@/components/ContributionDialog"
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
import { DatePicker } from "@/components/ui/date-picker"
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
import { effectiveFraction } from "@/lib/portfolio"

const CLASS_LABEL: Record<AssetClass, string> = { variable: "Renta variable", fija: "Renta fija" }
const KIND_LABEL: Record<AssetKind, string> = {
  etf: "ETF",
  fondo: "Fondo",
  accion: "Acción",
  cripto: "Cripto",
  otro: "Otro",
}
const NO_GROUP = "none"
const CLASSES: AssetClass[] = ["variable", "fija"]

/** Redondea a 2 decimales (para mostrar euros/porcentajes al usuario). */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Redondea a 8 decimales: la proporción interna de los grupos (que el usuario
 * elige en euros) necesita precisión para que el euro reconstruido cuadre exacto.
 * Con 2 decimales, 1000 € de 1500 € = 66,67% reconstruía 1000,05 €.
 */
function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8
}

/** Suma de pesos que debería dar 100; se usa para avisar si el reparto no cierra. */
function weightSum(weights: string[]): number {
  return round2(weights.reduce((s, w) => s + Number(w), 0))
}

/** Peso del total ya ocupado por lo de nivel superior: grupos + activos sueltos. */
function topLevelUsed(
  groups: InvestmentGroup[],
  assets: Asset[],
  { excludeGroup, excludeAsset }: { excludeGroup?: string; excludeAsset?: string } = {},
): number {
  let total = 0
  for (const g of groups) if (g.id !== excludeGroup) total += Number(g.weight)
  for (const a of assets) if (!a.group_id && a.id !== excludeAsset) total += Number(a.weight)
  return total
}

/** Margen del total libre para un grupo (100 - grupos y sueltos existentes). */
function groupRoom(groups: InvestmentGroup[], assets: Asset[], selfId?: string): number {
  return round8(Math.max(0, 100 - topLevelUsed(groups, assets, { excludeGroup: selfId })))
}

/** Margen para un activo: dentro de su clase en el grupo, o del total si es suelto. */
function assetRoom(
  groups: InvestmentGroup[],
  assets: Asset[],
  groupId: string | null,
  assetClass: AssetClass,
  selfId: string | undefined,
): number {
  if (groupId === null) {
    return round2(Math.max(0, 100 - topLevelUsed(groups, assets, { excludeAsset: selfId })))
  }
  const siblings = assets.filter(
    (a) => a.id !== selfId && a.group_id === groupId && a.asset_class === assetClass,
  )
  return round2(Math.max(0, 100 - siblings.reduce((s, a) => s + Number(a.weight), 0)))
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
  unit = "%",
}: {
  label: string
  value: string
  max: number
  onChange: (v: string) => void
  unit?: string
}) {
  const num = Number(value) || 0
  const sliderValue = Math.min(num, max) // el range necesita un número ≤ max
  const hint =
    unit === "%" && max >= 100
      ? "Hasta 100%."
      : `Tope: ${round2(max)} ${unit} (lo que queda libre).`

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
            className="h-7 w-24 px-2 py-0 text-right text-sm tabular-nums"
          />
          <span className="text-sm text-muted-foreground">{unit}</span>
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
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/** Barra del split renta variable/fija de un grupo (la fija es 100 − variable). */
function SplitSlider({
  variablePct,
  onChange,
}: {
  variablePct: string
  onChange: (v: string) => void
}) {
  const v = Math.min(100, Math.max(0, Number(variablePct) || 0))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label>Renta variable del grupo</Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={variablePct}
            aria-label="Renta variable del grupo"
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-20 px-2 py-0 text-right text-sm tabular-nums"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.01}
        value={v}
        aria-label="Split de renta variable del grupo"
        onChange={(e) => onChange(e.target.value)}
        className="w-full accent-[var(--invest)]"
      />
      <p className="text-xs text-muted-foreground">Renta fija: {round2(100 - v)}%</p>
    </div>
  )
}

export default function Portfolio() {
  const [rows, setRows] = useState<MonthAsset[]>([])
  const [groups, setGroups] = useState<InvestmentGroup[]>([])
  const [total, setTotal] = useState("")
  // La cartera es **por día**: el estado (previsto/aportado/hecho) y el registro se
  // refieren a esta fecha. Por defecto hoy; se puede elegir cualquier día (pasado
  // o futuro).
  const [date, setDate] = useState(todayISO())
  // Días con alguna aportación, para marcarlos en el calendario.
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [assetDialog, setAssetDialog] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [groupDialog, setGroupDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<InvestmentGroup | null>(null)
  const [contribDialog, setContribDialog] = useState(false)

  // El total y la fecha se leen por ref para que recargar la estructura NO dependa
  // de ellos: si dependiera, cada tecla recrearía `load`, dispararía el spinner y
  // desmontaría el input de "a invertir" (que perdía el foco a cada pulsación).
  const totalRef = useRef(total)
  totalRef.current = total
  const dateRef = useRef(date)
  dateRef.current = date

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true)
    try {
      const [grps, statusRows, dates] = await Promise.all([
        api.investment.listGroups(),
        api.investment.status(dateRef.current, totalRef.current || "0"),
        api.investment.contributionDates(),
      ])
      setGroups(grps)
      setRows(statusRows)
      setMarkedDates(new Set(dates))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la cartera")
    } finally {
      if (spinner) setLoading(false)
    }
  }, [])

  // Carga inicial (con spinner).
  useEffect(() => {
    void load(true)
  }, [load])

  // Al cambiar el total o la fecha, se recalcula el estado del día (importes/hecho),
  // sin spinner. Además, al **cambiar de día**, si ese día ya tiene aportaciones se
  // precarga "A invertir" con lo que se destinó (para que aparezca al revisarlo).
  const prevDate = useRef(date)
  useEffect(() => {
    const dateChanged = prevDate.current !== date
    prevDate.current = date
    const id = setTimeout(
      () => {
        api.investment
          .status(date, total || "0")
          .then((r) => {
            setRows(r)
            if (dateChanged) {
              const invested = r.reduce((s, x) => s + Number(x.contributed), 0)
              if (invested > 0) setTotal(String(round2(invested)))
            }
          })
          .catch(() => {})
      },
      dateChanged ? 0 : 250,
    )
    return () => clearTimeout(id)
  }, [total, date])

  const toggleDone = async (row: MonthAsset) => {
    setError(null)
    try {
      if (row.done) {
        await api.investment.undoContribution(row.asset.id, date)
      } else {
        if (Number(row.planned) <= 0) {
          setError("Indica cuánto vas a invertir para calcular el reparto")
          return
        }
        await api.investment.contribute(row.asset.id, row.planned, date)
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
  // Lo que el reparto deja sin destinar (grupos/activos que no llegan al total).
  const unassignedMoney = Math.max(0, (Number(total) || 0) - plannedTotal)
  const hasContent = rows.length > 0 || groups.length > 0
  const assets = useMemo(() => rows.map((r) => r.asset), [rows])

  // Exposición global calculada (ya no es un ajuste: es el resultado de los splits
  // de cada grupo). Suma del peso efectivo de cada clase sobre el total.
  const exposure = useMemo(() => {
    let variable = 0
    let fija = 0
    for (const asset of assets) {
      const frac = effectiveFraction(asset, groups)
      if (asset.asset_class === "variable") variable += frac
      else fija += frac
    }
    return { variable: round2(variable * 100), fija: round2(fija * 100) }
  }, [assets, groups])

  // Árbol para pintar: cada grupo con sus activos partidos por clase, y los sueltos.
  const tree = useMemo(() => {
    const grouped = groups.map((group) => {
      const groupRows = rows.filter((r) => r.asset.group_id === group.id)
      const byClass = CLASSES.map((cls) => ({
        cls,
        pct: cls === "variable" ? Number(group.variable_pct) : Number(group.fixed_pct),
        rows: groupRows.filter((r) => r.asset.asset_class === cls),
      })).filter((c) => c.pct > 0 || c.rows.length > 0)
      return { group, byClass }
    })
    const loose = rows.filter((r) => !r.asset.group_id)
    return { grouped, loose }
  }, [rows, groups])

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          Cartera
          <PortfolioHint />
        </h1>
        <div className="flex flex-wrap justify-end gap-2">
          {assets.length > 0 ? (
            <Button variant="outline" onClick={() => setContribDialog(true)}>
              Aportación extra
            </Button>
          ) : null}
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
            Crea un grupo (por ejemplo tu bróker) con su reparto entre renta variable y renta
            fija, mete dentro tus activos con su peso, y la app calculará cuánto destinar a cada
            uno cada mes.
          </p>
        </div>
      ) : (
        <>
          {/* Calculadora del día: fecha + total a repartir */}
          <section className="mb-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label>Fecha</Label>
                <DatePicker
                  value={date}
                  onChange={setDate}
                  placeholder="Elige una fecha"
                  aria-label="Fecha"
                  marked={markedDates}
                />
              </div>
              <div className="min-w-40 flex-1 space-y-1">
                <Label htmlFor="total">A invertir (€)</Label>
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
                Reparte {formatMoney(plannedTotal)}
                {unassignedMoney > 0.005 ? (
                  <span className="text-bucket-amber"> · {formatMoney(unassignedMoney)} sin asignar</span>
                ) : null}{" "}
                · {doneCount}/{rows.length} hecho
              </p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              El estado (previsto, aportado, hecho) es el de esta fecha. Cambia el día para ver o
              registrar aportaciones de otra fecha, pasada o futura.
            </p>
          </section>

          {/* Gráfico del reparto por activo */}
          {assets.length > 0 ? (
            <section className="mb-6 rounded-lg border p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
                <h2 className="font-semibold">Reparto por activo</h2>
                <p className="text-sm text-muted-foreground">
                  En conjunto: {exposure.variable}% renta variable · {exposure.fija}% renta fija
                </p>
              </div>
              <PortfolioDonut
                items={assets.map((a) => ({
                  id: a.id,
                  name: a.name,
                  fraction: effectiveFraction(a, groups),
                }))}
                unassignedLabel="Sin asignar"
              />
            </section>
          ) : null}

          {/* Árbol: grupos (con su split) → activos por clase, y activos sueltos */}
          <div className="space-y-5">
            {tree.grouped.map(({ group, byClass }) => (
              <section key={group.id} className="rounded-lg border">
                <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                  <span className="min-w-0">
                    <span className="text-sm font-medium">{group.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      · {round2(Number(group.weight))}% del total ·{" "}
                      {round2(Number(group.variable_pct))}/{round2(Number(group.fixed_pct))} var/fija
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
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

                {byClass.map(({ cls, pct, rows: clsRows }) => (
                  <div key={cls} className="border-b last:border-b-0">
                    <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {CLASS_LABEL[cls]} · {round2(pct)}% del grupo
                    </p>
                    {clsRows.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Sin activos de esta clase; su {round2(pct)}% queda sin asignar.
                      </p>
                    ) : (
                      <AssetRows
                        rows={clsRows}
                        onToggle={toggleDone}
                        onEdit={(a) => {
                          setEditingAsset(a)
                          setAssetDialog(true)
                        }}
                      />
                    )}
                    {clsRows.length > 0 && weightSum(clsRows.map((r) => r.asset.weight)) !== 100 ? (
                      <p className="px-3 py-1.5 text-xs text-bucket-amber">
                        Los pesos suman {weightSum(clsRows.map((r) => r.asset.weight))}%, no 100%.
                      </p>
                    ) : null}
                  </div>
                ))}
              </section>
            ))}

            {tree.loose.length > 0 ? (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sin grupo · % del total
                </h3>
                <div className="rounded-lg border">
                  <AssetRows
                    rows={tree.loose}
                    onToggle={toggleDone}
                    onEdit={(a) => {
                      setEditingAsset(a)
                      setAssetDialog(true)
                    }}
                  />
                </div>
              </section>
            ) : null}
          </div>

          <div className="mt-6 text-center">
            <Link to="/cartera/estado" className="text-sm text-primary hover:underline">
              Ver estado real de la cartera →
            </Link>
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
        assets={assets}
        total={Number(total) || 0}
        onOpenChange={setGroupDialog}
        onSaved={() => {
          setGroupDialog(false)
          void load()
        }}
      />
      <ContributionDialog
        open={contribDialog}
        groups={groups}
        assets={assets}
        defaultDate={date}
        onOpenChange={setContribDialog}
        onSaved={() => {
          setContribDialog(false)
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
              {KIND_LABEL[row.asset.kind]} · {round2(Number(row.asset.weight))}%
              {Number(row.total_contributed) > 0
                ? ` · aportado ${formatMoney(row.total_contributed)}`
                : ""}
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
  assets,
  total,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  group: InvestmentGroup | null
  groups: InvestmentGroup[]
  assets: Asset[]
  total: number
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [weight, setWeight] = useState("") // guardado como % (proporción del total)
  const [variablePct, setVariablePct] = useState("100")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const room = groupRoom(groups, assets, group?.id) // en %
  // El peso se reparte en EUROS del total del mes (proporcional): se guarda el %,
  // pero el usuario elige y ve euros. Si aún no hay total, se cae a % con aviso.
  const euroMode = total > 0
  const pctNum = Number(weight) || 0
  const euros = String(round2((pctNum * total) / 100))
  const maxEuros = round2((room * total) / 100)
  const setFromEuros = (eur: string) =>
    setWeight(String(round8(total > 0 ? ((Number(eur) || 0) / total) * 100 : 0)))

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(group?.name ?? "")
    // Al crear, se propone el margen libre (típico: un solo grupo/bróker al 100%).
    setWeight(group?.weight ?? String(groupRoom(groups, assets, undefined)))
    setVariablePct(group?.variable_pct ?? "100")
  }, [open, group, groups, assets])

  const submit = async () => {
    setSaving(true)
    setError(null)
    const v = round2(Math.min(100, Math.max(0, Number(variablePct) || 0)))
    const input: GroupInput = {
      name: name.trim(),
      weight: weight || "0",
      variable_pct: String(v),
      fixed_pct: String(round2(100 - v)),
    }
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
              placeholder="Interactive Brokers"
              maxLength={100}
            />
          </div>
          {euroMode ? (
            <div className="space-y-1">
              <WeightSlider
                label="Dinero de este grupo"
                value={euros}
                max={maxEuros}
                onChange={setFromEuros}
                unit="€"
              />
              <p className="text-xs text-muted-foreground">
                De los {formatMoney(total)} de este mes. Se guarda como proporción: si cambias el
                total, este importe se ajusta solo.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <WeightSlider
                label="Peso sobre el total"
                value={weight}
                max={room}
                onChange={setWeight}
              />
              <p className="text-xs text-muted-foreground">
                Indica arriba cuánto vas a invertir este mes para repartirlo en euros.
              </p>
            </div>
          )}
          {room <= 0 ? (
            <p className="text-xs text-bucket-amber">
              No queda dinero libre del total (los grupos y activos sueltos ya se lo reparten todo).
              Para meter otro grupo, baja antes el de uno existente o el de un activo suelto.
            </p>
          ) : null}
          <SplitSlider variablePct={variablePct} onChange={setVariablePct} />
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
    // Al crear, si hay grupos, se propone el primero (lo normal: meter todo en tu
    // bróker). Se puede cambiar a "Sin grupo" o a otro.
    setGroupId(asset?.group_id ?? groups[0]?.id ?? NO_GROUP)
  }, [open, asset, groups])

  const targetGroup = groupId === NO_GROUP ? null : groupId

  const submit = async () => {
    setSaving(true)
    setError(null)
    const input: AssetInput = {
      name: name.trim(),
      asset_class: assetClass,
      kind,
      weight: weight || "0",
      group_id: targetGroup,
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
                <SelectItem value={NO_GROUP}>Sin grupo (pesa sobre el total)</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="asset-class">Clase</Label>
              <Select value={assetClass} onValueChange={(v) => setAssetClass(v as AssetClass)}>
                <SelectTrigger id="asset-class" aria-label="Clase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASSES.map((c) => (
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
            label={targetGroup ? `Peso dentro de su clase en el grupo` : "Peso sobre el total"}
            value={weight}
            max={assetRoom(groups, assets, targetGroup, assetClass, asset?.id)}
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
