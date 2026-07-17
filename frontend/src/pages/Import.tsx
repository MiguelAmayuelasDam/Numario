import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CategoryOptions } from "@/components/CategoryOptions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApiError, api, type Category, type ImportSummary, type TransactionType } from "@/lib/api"
import { amountClass, signedAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

const NO_CATEGORY = "none"

interface EditableRow {
  concept: string
  occurred_on: string
  amount: string
  type: TransactionType
  source: "learned" | "rule" | null
  duplicate: boolean
  include: boolean
  categoryId: string
}

function SummaryChip({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm",
        highlight && value > 0 && "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/20",
      )}
    >
      <span className="font-semibold">{value}</span>{" "}
      <span className={highlight && value > 0 ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  )
}

export default function Import() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [errorDetails, setErrorDetails] = useState<string[]>([])
  const [rows, setRows] = useState<EditableRow[]>([])
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.categories.list().then(setCategories).catch(() => setCategories([]))
  }, [])

  const onPreview = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.imports.preview(file)
      setSummary(res.summary)
      setErrorDetails(res.error_details)
      setRows(
        res.rows.map((r) => ({
          concept: r.concept,
          occurred_on: r.occurred_on,
          amount: r.amount,
          type: r.type,
          source: r.source,
          duplicate: r.duplicate,
          include: !r.duplicate,
          categoryId: r.suggested_category_id ?? NO_CATEGORY,
        })),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo leer el archivo")
      setSummary(null)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const setRow = (i: number, patch: Partial<EditableRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const includedCount = rows.filter((r) => r.include).length

  const onConfirm = async () => {
    const items = rows
      .filter((r) => r.include)
      .map((r) => ({
        amount: r.amount,
        type: r.type,
        concept: r.concept,
        occurred_on: r.occurred_on,
        category_id: r.categoryId === NO_CATEGORY ? null : r.categoryId,
      }))
    if (items.length === 0) return
    setConfirming(true)
    setError(null)
    try {
      await api.imports.confirm(items)
      navigate("/movimientos")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo importar")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Importar movimientos</h1>
        <Button variant="ghost" asChild>
          <Link to="/movimientos">Volver a movimientos</Link>
        </Button>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Input
          type="file"
          accept=".csv,text/csv"
          aria-label="Archivo CSV"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="max-w-xs"
        />
        <Button onClick={() => void onPreview()} disabled={!file || loading}>
          {loading ? "Leyendo…" : "Previsualizar"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Extracto CSV de tu banco (formato imagin/CaixaBank).
        </p>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="mb-4 flex flex-wrap gap-2" data-testid="import-summary">
          <SummaryChip label="movimientos" value={summary.total} />
          <SummaryChip label="clasificados" value={summary.classified} />
          <SummaryChip label="sin categorizar" value={summary.needs_review} highlight />
          <SummaryChip label="duplicados" value={summary.duplicates} />
          {summary.errors > 0 ? <SummaryChip label="con error" value={summary.errors} /> : null}
        </div>
      ) : null}

      {errorDetails.length > 0 ? (
        <ul className="mb-4 list-inside list-disc text-xs text-destructive">
          {errorDetails.slice(0, 5).map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}

      {rows.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Categoría</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                // Resalta (en ámbar, no rojo: es válido guardarlo sin categoría)
                // las filas que se van a importar y siguen sin categorizar.
                const uncategorized = r.include && r.categoryId === NO_CATEGORY
                return (
                <TableRow
                  key={i}
                  className={cn(
                    !r.include && "opacity-50",
                    uncategorized &&
                      "bg-amber-50 shadow-[inset_3px_0_0_0] shadow-amber-400 dark:bg-amber-950/20",
                  )}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Incluir ${r.concept}`}
                      checked={r.include}
                      onChange={(e) => setRow(i, { include: e.target.checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{r.concept}</span>
                    {r.duplicate ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        Duplicado
                      </span>
                    ) : null}
                    {r.source === "learned" ? (
                      <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        aprendida
                      </span>
                    ) : null}
                    {uncategorized ? (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Sin categorizar
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.occurred_on}</TableCell>
                  <TableCell className={"whitespace-nowrap text-right font-semibold " + amountClass(r.type)}>
                    {signedAmount(r.amount, r.type)}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.categoryId}
                      onValueChange={(v) => setRow(i, { categoryId: v })}
                    >
                      <SelectTrigger
                        aria-label={`Categoría de ${r.concept}`}
                        className={cn(
                          "min-w-44",
                          uncategorized && "border-amber-400 ring-2 ring-amber-300/70",
                        )}
                      >
                        <SelectValue placeholder="Sin categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                        <CategoryOptions categories={categories} />
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => void onConfirm()} disabled={includedCount === 0 || confirming}>
              {confirming ? "Importando…" : `Confirmar importación (${includedCount})`}
            </Button>
          </div>
        </>
      ) : null}
    </main>
  )
}
