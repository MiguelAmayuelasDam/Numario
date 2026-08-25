import { useEffect, useState } from "react"

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
import { type Asset, ApiError, type InvestmentGroup, api } from "@/lib/api"
import { todayISO } from "@/lib/format"
import { MAX_AMOUNT, withinCap } from "@/lib/money"

const NO_GROUP = "none"

/**
 * Aportación (extra) a un activo concreto: eliges grupo → activo → importe →
 * fecha, para registrar dinero real al margen del reparto automático (p. ej.
 * dejas de invertir en uno y pones el sobrante en otro). Sirve para meses
 * pasados y actuales. Queda como movimiento con fecha, suma al total del activo
 * y aparece en el historial.
 */
export function ContributionDialog({
  open,
  groups,
  assets,
  defaultDate,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  groups: InvestmentGroup[]
  assets: Asset[]
  defaultDate?: string
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [groupId, setGroupId] = useState<string>(NO_GROUP)
  const [assetId, setAssetId] = useState<string>("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(defaultDate ?? todayISO())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const hasLoose = assets.some((a) => !a.group_id)
  const assetsInGroup = assets.filter((a) =>
    groupId === NO_GROUP ? !a.group_id : a.group_id === groupId,
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setAmount("")
    setDate(defaultDate ?? todayISO())
    setGroupId(groups[0]?.id ?? (hasLoose ? NO_GROUP : ""))
  }, [open, groups, hasLoose, defaultDate])

  // Al cambiar el grupo (o al abrir), el activo salta al primero de ese grupo.
  useEffect(() => {
    const first = assets.find((a) => (groupId === NO_GROUP ? !a.group_id : a.group_id === groupId))
    setAssetId(first?.id ?? "")
  }, [groupId, assets])

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.investment.contribute(assetId, amount, date, true)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la aportación")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aportación extra</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="contrib-group">Grupo</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger id="contrib-group" aria-label="Grupo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
                {hasLoose ? <SelectItem value={NO_GROUP}>Sin grupo</SelectItem> : null}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="contrib-asset">Activo</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger id="contrib-asset" aria-label="Activo">
                <SelectValue placeholder="Elige un activo" />
              </SelectTrigger>
              <SelectContent>
                {assetsInGroup.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assetsInGroup.length === 0 ? (
              <p className="text-xs text-muted-foreground">Este grupo no tiene activos.</p>
            ) : null}
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="contrib-amount">Importe (€)</Label>
              <Input
                id="contrib-amount"
                type="number"
                inputMode="decimal"
                min="0"
                max={MAX_AMOUNT}
                step="0.01"
                placeholder="p. ej. 150,00"
                value={amount}
                onChange={(e) => withinCap(e.target.value) && setAmount(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label>Fecha</Label>
              <DatePicker
                value={date}
                onChange={setDate}
                placeholder="Elige una fecha"
                aria-label="Fecha de la aportación"
                className="w-full"
              />
            </div>
          </div>
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
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!assetId || !(Number(amount) > 0) || saving}
          >
            Aportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
