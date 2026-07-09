import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { TransactionForm } from "@/components/TransactionForm"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/context/AuthContext"
import { ApiError, api, type Category, type Transaction, type TransactionInput } from "@/lib/api"

function formatAmount(t: Transaction): string {
  const sign = t.type === "income" ? "+" : "−"
  return `${sign}${t.amount} €`
}

export default function Transactions() {
  const { user, logout } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [tx, cats] = await Promise.all([api.transactions.list(), api.categories.list()])
    setTransactions(tx)
    setCategories(cats)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        await refresh()
      } finally {
        setLoading(false)
      }
    })()
  }, [refresh])

  const openCreate = () => {
    setEditing(null)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (t: Transaction) => {
    setEditing(t)
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSubmit = async (input: TransactionInput) => {
    setSubmitting(true)
    setFormError(null)
    try {
      if (editing) {
        await api.transactions.update(editing.id, input)
      } else {
        await api.transactions.create(input)
      }
      setDialogOpen(false)
      await refresh()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar el movimiento")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (t: Transaction) => {
    if (!window.confirm(`¿Borrar el movimiento "${t.concept}"?`)) return
    await api.transactions.remove(t.id)
    await refresh()
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Movimientos</h1>
          <p className="text-sm text-muted-foreground">Hola, {user?.nickname}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/">Inicio</Link>
          </Button>
          <Button variant="outline" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}>Añadir movimiento</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : transactions.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          Aún no tienes movimientos. Pulsa «Añadir movimiento» para empezar.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Importe</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id} data-testid="transaction-row">
                <TableCell>{t.occurred_on}</TableCell>
                <TableCell className="font-medium">{t.concept}</TableCell>
                <TableCell>{t.category?.name ?? "—"}</TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    t.type === "income" ? "text-green-600" : "text-foreground"
                  }`}
                >
                  {formatAmount(t)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void handleDelete(t)}>
                    Borrar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
            <DialogDescription>
              Registra una entrada o salida de dinero.
            </DialogDescription>
          </DialogHeader>
          <TransactionForm
            key={editing?.id ?? "new"}
            categories={categories}
            initial={editing ?? undefined}
            submitting={submitting}
            error={formError}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </main>
  )
}
