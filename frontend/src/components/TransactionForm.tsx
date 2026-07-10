import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Category, Transaction, TransactionInput, TransactionType } from "@/lib/api"

const NO_CATEGORY = "none"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransactionForm({
  categories,
  initial,
  submitting,
  error,
  onSubmit,
}: {
  categories: Category[]
  initial?: Transaction
  submitting: boolean
  error: string | null
  onSubmit: (input: TransactionInput) => void
}) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense")
  const [amount, setAmount] = useState(initial?.amount ?? "")
  const [concept, setConcept] = useState(initial?.concept ?? "")
  const [occurredOn, setOccurredOn] = useState(initial?.occurred_on ?? today())
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? NO_CATEGORY)

  const amountValid = Number(amount) > 0
  const canSubmit =
    amountValid && concept.trim().length > 0 && occurredOn.length > 0 && !submitting

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit({
      amount,
      type,
      concept: concept.trim(),
      occurred_on: occurredOn,
      category_id: categoryId === NO_CATEGORY ? null : categoryId,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="type">Tipo</Label>
        <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
          <SelectTrigger id="type" aria-label="Tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Gasto</SelectItem>
            <SelectItem value="income">Ingreso</SelectItem>
            <SelectItem value="transfer">No computable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Importe (€)</Label>
        <Input
          id="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="concept">Concepto</Label>
        <Input
          id="concept"
          type="text"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="occurred_on">Fecha</Label>
        <Input
          id="occurred_on"
          type="date"
          max={today()}
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Categoría</Label>
        <Select value={categoryId ?? NO_CATEGORY} onValueChange={setCategoryId}>
          <SelectTrigger id="category" aria-label="Categoría">
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
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {submitting ? "Guardando…" : "Guardar movimiento"}
      </Button>
    </form>
  )
}
