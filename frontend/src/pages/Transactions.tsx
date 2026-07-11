import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, Search } from "lucide-react"

import { SplitTransaction } from "@/components/SplitTransaction"
import { TransactionForm } from "@/components/TransactionForm"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/context/AuthContext"
import {
  ApiError,
  api,
  type Category,
  type Transaction,
  type TransactionFilters,
  type TransactionInput,
} from "@/lib/api"
import {
  BUCKET_META,
  formatDateHeader,
  formatSignedAmount,
  groupByDate,
  todayISO,
} from "@/lib/format"

type Tab = "all" | "expense" | "income" | "transfer"
type PanelMode = "view" | "edit" | "split"

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "expense", label: "Gastos" },
  { key: "income", label: "Ingresos" },
  { key: "transfer", label: "No computable" },
]

const ALL_CATEGORIES = "all"

function amountClass(type: Transaction["type"]): string {
  if (type === "income") return "text-green-600"
  if (type === "transfer") return "text-muted-foreground"
  return "text-foreground"
}

export default function Transactions() {
  const { logout } = useAuth()
  const today = todayISO()
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros de servidor (fecha y categoría).
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES)
  // Filtros de cliente (pestaña por tipo y buscador por concepto).
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")

  // Fila desplegada (acordeón) y su modo.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>("view")
  const [rowSubmitting, setRowSubmitting] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  // Diálogo de alta (solo para crear).
  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Movimiento pendiente de confirmar su borrado (modal propio).
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null)

  useEffect(() => {
    api.categories.list().then(setCategories).catch(() => setCategories([]))
  }, [])

  const loadTransactions = useCallback(async () => {
    const filters: TransactionFilters = {}
    if (dateFrom) filters.from = dateFrom
    if (dateTo) filters.to = dateTo
    if (categoryId !== ALL_CATEGORIES) filters.category_id = categoryId
    setTransactions(await api.transactions.list(filters))
  }, [dateFrom, dateTo, categoryId])

  useEffect(() => {
    setLoading(true)
    loadTransactions().finally(() => setLoading(false))
  }, [loadTransactions])

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()
    const visible = transactions.filter((t) => {
      if (tab !== "all" && t.type !== tab) return false
      if (term && !t.concept.toLowerCase().includes(term)) return false
      return true
    })
    return groupByDate(visible)
  }, [transactions, tab, search])

  const collapse = () => {
    setExpandedId(null)
    setPanelMode("view")
    setRowError(null)
  }

  const toggleRow = (t: Transaction) => {
    setRowError(null)
    if (expandedId === t.id) {
      collapse()
    } else {
      setExpandedId(t.id)
      setPanelMode("view")
    }
  }

  const reloadAndCollapse = async () => {
    await loadTransactions()
    collapse()
  }

  const handleUpdate = async (t: Transaction, input: TransactionInput) => {
    setRowSubmitting(true)
    setRowError(null)
    try {
      await api.transactions.update(t.id, input)
      await reloadAndCollapse()
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "No se pudo guardar")
    } finally {
      setRowSubmitting(false)
    }
  }

  const performDelete = async () => {
    if (!confirmDelete) return
    const target = confirmDelete
    setConfirmDelete(null)
    await api.transactions.remove(target.id)
    await reloadAndCollapse()
  }

  const handleCreate = async (input: TransactionInput) => {
    setCreateSubmitting(true)
    setCreateError(null)
    try {
      await api.transactions.create(input)
      setCreateOpen(false)
      await loadTransactions()
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "No se pudo crear el movimiento")
    } finally {
      setCreateSubmitting(false)
    }
  }

  const hasDateFilter = dateFrom !== "" || dateTo !== ""

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Movimientos</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/analisis">Análisis</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/">Inicio</Link>
          </Button>
          <Button variant="outline" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      {/* Filtros: fechas, categoría y buscador */}
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Fechas</span>
            <DatePicker
              placeholder="Inicio"
              aria-label="Fecha de inicio"
              value={dateFrom}
              onChange={setDateFrom}
              max={dateTo || today}
              className="w-40"
            />
            <span className="text-muted-foreground">a</span>
            <DatePicker
              placeholder="Fin"
              aria-label="Fecha de fin"
              value={dateTo}
              onChange={setDateTo}
              min={dateFrom || undefined}
              max={today}
              className="w-40"
            />
          </div>
          {hasDateFilter ? (
            <button
              type="button"
              onClick={() => {
                setDateFrom("")
                setDateTo("")
              }}
              className="mt-1 text-xs text-primary hover:underline"
            >
              Borrar fechas
            </button>
          ) : null}
        </div>

        <div className="min-w-48 flex-1">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger aria-label="Filtrar por categoría">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ""}
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por concepto"
            aria-label="Buscar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Pestañas por tipo + botón de alta */}
      <div className="mb-2 flex items-center justify-between border-b">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/importar">Importar CSV</Link>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Añadir movimiento
          </Button>
        </div>
      </div>

      {/* Listado agrupado por fecha */}
      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Cargando…</p>
      ) : groups.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          No hay movimientos que mostrar.
        </p>
      ) : (
        <div>
          {groups.map((group) => (
            <section key={group.date}>
              <h2 className="bg-[#F3F6F9] px-3 py-1.5 text-xs font-medium text-muted-foreground dark:bg-muted/40">
                {formatDateHeader(group.date)}
              </h2>
              <ul>
                {group.items.map((t) => (
                  <li key={t.id} className="border-b">
                    <button
                      type="button"
                      onClick={() => toggleRow(t)}
                      data-testid="transaction-row"
                      aria-expanded={expandedId === t.id}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                        {t.category?.emoji ?? "🏷️"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          {t.category ? (
                            <span
                              className={
                                "size-2 shrink-0 rounded-full " + BUCKET_META[t.category.bucket].dot
                              }
                              title={BUCKET_META[t.category.bucket].label}
                            />
                          ) : null}
                          <span className="truncate font-semibold text-foreground">
                            {t.concept}
                          </span>
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {t.category?.name ?? "Sin categoría"}
                        </span>
                      </span>
                      <span className={"shrink-0 font-semibold " + amountClass(t.type)}>
                        {formatSignedAmount(t)}
                      </span>
                      <ChevronDown
                        className={
                          "size-4 shrink-0 text-muted-foreground transition-transform " +
                          (expandedId === t.id ? "rotate-180" : "")
                        }
                      />
                    </button>

                    {expandedId === t.id ? (
                      <div className="bg-muted/20 px-3 pb-4 pt-1">
                        {panelMode === "view" ? (
                          <div className="space-y-3">
                            <p className={"text-2xl font-bold " + amountClass(t.type)}>
                              {formatSignedAmount(t)}
                            </p>
                            <div className="text-sm text-muted-foreground">
                              <p>{formatDateHeader(t.occurred_on)}</p>
                              <p>
                                {t.category
                                  ? `${t.category.emoji ?? ""} ${t.category.name} · ${BUCKET_META[t.category.bucket].label}`
                                  : "Sin categoría"}
                              </p>
                            </div>
                            {rowError ? (
                              <p className="text-sm text-destructive" role="alert">
                                {rowError}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => setPanelMode("edit")}>
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPanelMode("split")}
                              >
                                Dividir
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setConfirmDelete(t)}
                              >
                                Borrar
                              </Button>
                            </div>
                          </div>
                        ) : panelMode === "edit" ? (
                          <div className="space-y-2">
                            <TransactionForm
                              categories={categories}
                              initial={t}
                              submitting={rowSubmitting}
                              error={rowError}
                              onSubmit={(input) => void handleUpdate(t, input)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              onClick={() => setPanelMode("view")}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <SplitTransaction
                            transaction={t}
                            categories={categories}
                            onDone={() => void reloadAndCollapse()}
                            onCancel={() => setPanelMode("view")}
                          />
                        )}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Diálogo de alta */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo movimiento</DialogTitle>
            <DialogDescription>Registra una entrada o salida de dinero.</DialogDescription>
          </DialogHeader>
          <TransactionForm
            categories={categories}
            submitting={createSubmitting}
            error={createError}
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de borrado */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Borrar movimiento</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres borrar «{confirmDelete?.concept}»? Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void performDelete()}>
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
