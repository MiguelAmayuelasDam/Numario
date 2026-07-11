import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/context/AuthContext"
import Import from "@/pages/Import"

function json(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: async () => body } as Response
}

const PREVIEW = {
  rows: [
    {
      concept: "MERCADONA JULIAN",
      occurred_on: "2026-06-24",
      amount: "13.18",
      type: "expense",
      suggested_category_id: "c1",
      category: { id: "c1", name: "Supermercado", bucket: "living", emoji: "🛒", is_default: true },
      source: "rule",
      duplicate: false,
    },
    {
      concept: "BAR FETICHE",
      occurred_on: "2026-07-10",
      amount: "6.40",
      type: "expense",
      suggested_category_id: null,
      category: null,
      source: null,
      duplicate: true,
    },
  ],
  summary: { total: 2, classified: 1, needs_review: 1, duplicates: 1, errors: 0 },
  error_details: [],
}

function installFetch() {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.includes("/categories")) return json(200, [])
    if (url.includes("/import/preview")) return json(200, PREVIEW)
    if (url.includes("/import/confirm")) return json(201, { created: 1 })
    return json(404, { detail: "no" })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/importar"]}>
      <AuthProvider>
        <Routes>
          <Route path="/importar" element={<Import />} />
          <Route path="/movimientos" element={<div>MOVIMIENTOS</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

beforeEach(() => localStorage.setItem("numario.access", "ACC"))

describe("Import", () => {
  it("previsualiza el CSV y muestra el resumen y las filas", async () => {
    installFetch()
    const user = userEvent.setup()
    renderPage()

    const file = new File(["Concepto;Fecha;Importe\n"], "extracto.csv", { type: "text/csv" })
    await user.upload(screen.getByLabelText("Archivo CSV"), file)
    await user.click(screen.getByRole("button", { name: "Previsualizar" }))

    expect(await screen.findByText("MERCADONA JULIAN")).toBeInTheDocument()
    expect(screen.getByText("BAR FETICHE")).toBeInTheDocument()
    // Duplicado marcado.
    expect(screen.getByText("Duplicado")).toBeInTheDocument()
    // Resumen.
    expect(screen.getByTestId("import-summary")).toHaveTextContent("2")
  })

  it("confirma solo las filas incluidas y navega a movimientos", async () => {
    const fetchMock = installFetch()
    const user = userEvent.setup()
    renderPage()

    const file = new File(["x"], "extracto.csv", { type: "text/csv" })
    await user.upload(screen.getByLabelText("Archivo CSV"), file)
    await user.click(screen.getByRole("button", { name: "Previsualizar" }))
    await screen.findByText("MERCADONA JULIAN")

    // El duplicado (BAR FETICHE) viene desmarcado → solo se confirma 1.
    await user.click(screen.getByRole("button", { name: /Confirmar importación/ }))

    await waitFor(() => expect(screen.getByText("MOVIMIENTOS")).toBeInTheDocument())
    const confirmCall = fetchMock.mock.calls.find(([u]) => (u as string).includes("/import/confirm"))
    const body = JSON.parse((confirmCall![1] as RequestInit).body as string)
    expect(body.items).toHaveLength(1)
    expect(body.items[0].concept).toBe("MERCADONA JULIAN")
  })
})
