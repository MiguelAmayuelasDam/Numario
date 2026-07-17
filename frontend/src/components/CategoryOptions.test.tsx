import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CategoryOptions } from "@/components/CategoryOptions"
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Category } from "@/lib/api"

// `globals: false` en vite.config.ts → Testing Library no engancha su limpieza
// automática. Sin esto, el Select abierto de un test deja el portal montado y el
// siguiente encuentra dos combobox (y un body con pointer-events: none).
afterEach(cleanup)

const cat = (id: string, name: string, bucket: Category["bucket"]): Category => ({
  id,
  name,
  bucket,
  emoji: null,
  is_default: true,
})

const CATEGORIES: Category[] = [
  cat("1", "Nómina", "income"),
  cat("2", "Fondo indexado", "investment"),
  cat("3", "Supermercado", "living"),
  cat("4", "Restaurante", "monthly"),
  cat("5", "Hipoteca", "living"),
  cat("6", "Traspasos", "transfer"),
]

async function open(categories: Category[]) {
  render(
    <Select>
      <SelectTrigger aria-label="Categoría">
        <SelectValue placeholder="Elige" />
      </SelectTrigger>
      <SelectContent>
        <CategoryOptions categories={categories} />
      </SelectContent>
    </Select>,
  )
  // Radix pinta también un <select> nativo oculto con el mismo aria-label; el
  // que abre la lista es el trigger, que es quien tiene role="combobox".
  await userEvent.click(screen.getByRole("combobox", { name: "Categoría" }))
}

describe("CategoryOptions", () => {
  it("pone cada categoría bajo la cabecera de su cubo", async () => {
    await open(CATEGORIES)

    for (const header of ["Vida", "Mes", "Inversión", "Ingresos", "No computable"]) {
      expect(screen.getByText(header)).toBeInTheDocument()
    }
    expect(screen.getByText("Supermercado")).toBeInTheDocument()
    expect(screen.getByText("Nómina")).toBeInTheDocument()
  })

  it("muestra los cubos en el orden 50-30-20", async () => {
    await open(CATEGORIES)

    const text = screen.getByRole("listbox").textContent ?? ""
    expect(text.indexOf("Vida")).toBeLessThan(text.indexOf("Mes"))
    expect(text.indexOf("Mes")).toBeLessThan(text.indexOf("Inversión"))
    expect(text.indexOf("Inversión")).toBeLessThan(text.indexOf("Ingresos"))
  })

  it("no pinta cabeceras de cubos vacíos", async () => {
    await open([cat("1", "Supermercado", "living")])

    expect(screen.getByText("Vida")).toBeInTheDocument()
    expect(screen.queryByText("Inversión")).not.toBeInTheDocument()
    expect(screen.queryByText("No computable")).not.toBeInTheDocument()
  })

  it("aguanta sin categorías", async () => {
    await open([])

    expect(screen.queryByText("Vida")).not.toBeInTheDocument()
  })
})
