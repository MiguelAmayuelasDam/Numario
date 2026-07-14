import { useMemo, useState } from "react"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError, api, type Category, type Transaction } from "@/lib/api"

const NO_CATEGORY = "none"

interface Part {
  amount: string
  categoryId: string
}

function toCents(value: string): number {
  return Math.round(Number(value || "0") * 100)
}

function euros(cents: number): string {
  return `${(cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export function SplitTransaction({
  transaction,
  categories,
  onDone,
  onCancel,
}: {
  transaction: Transaction
  categories: Category[]
  onDone: () => void
  onCancel: () => void
}) {
  const [parts, setParts] = useState<Part[]>([
    { amount: "", categoryId: transaction.category_id ?? NO_CATEGORY },
    { amount: "", categoryId: NO_CATEGORY },
  ])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const totalCents = transaction.amount ? toCents(transaction.amount) : 0
  const sumCents = useMemo(() => parts.reduce((acc, p) => acc + toCents(p.amount), 0), [parts])
  const remainingCents = totalCents - sumCents
  const allPositive = parts.every((p) => toCents(p.amount) > 0)
  const canSplit = remainingCents === 0 && allPositive && parts.length >= 2 && !submitting

  const setPart = (i: number, patch: Partial<Part>) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  const addPart = () => setParts((prev) => [...prev, { amount: "", categoryId: NO_CATEGORY }])
  const removePart = (i: number) => setParts((prev) => prev.filter((_, idx) => idx !== i))

  const handleSplit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await api.transactions.split(
        transaction.id,
        parts.map((p) => ({
          amount: p.amount,
          category_id: p.categoryId === NO_CATEGORY ? null : p.categoryId,
        })),
      )
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo dividir el movimiento")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">Dividir movimiento</p>
        <p className="text-sm text-muted-foreground">
          Reparte el importe entre varias categorías (deben sumar el total).
        </p>
      </div>

      <ul className="space-y-2">
        {parts.map((part, i) => (
          <li key={i} className="flex items-center gap-2">
            <Select
              value={part.categoryId}
              onValueChange={(v) => setPart(i, { categoryId: v })}
            >
              <SelectTrigger aria-label={`Categoría parte ${i + 1}`} className="flex-1">
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.emoji ? `${c.emoji} ` : ""}
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              aria-label={`Importe parte ${i + 1}`}
              value={part.amount}
              onChange={(e) => setPart(i, { amount: e.target.value })}
              className="w-28"
            />
            {parts.length > 2 ? (
              <button
                type="button"
                aria-label={`Quitar parte ${i + 1}`}
                onClick={() => removePart(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            ) : (
              <span className="w-4" />
            )}
          </li>
        ))}
      </ul>

      <Button type="button" variant="ghost" size="sm" onClick={addPart} className="gap-1">
        <Plus className="size-4" /> Añadir división
      </Button>

      <div className="border-t pt-2 text-right text-sm">
        <span className="text-muted-foreground">Total </span>
        <span className={remainingCents === 0 ? "font-semibold text-income" : "font-semibold text-destructive"}>
          {euros(sumCents)}
        </span>
        <span className="text-muted-foreground"> / {euros(totalCents)}</span>
        {remainingCents !== 0 ? (
          <p className="text-destructive" role="alert">
            {remainingCents > 0
              ? `Te falta ${euros(remainingCents)}`
              : `Te sobra ${euros(-remainingCents)}`}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void handleSplit()} disabled={!canSplit}>
          Dividir
        </Button>
      </div>
    </div>
  )
}
