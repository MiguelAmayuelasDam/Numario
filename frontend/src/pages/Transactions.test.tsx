import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/context/AuthContext"
import type { Transaction } from "@/lib/api"
import Transactions from "@/pages/Transactions"

function json(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: async () => body } as Response
}

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    amount: "10.00",
    type: "expense",
    concept: "Base",
    occurred_on: "2026-07-01",
    category_id: null,
    category: null,
    source: "manual",
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  }
}

// Mock de fetch con estado: mantiene la lista de movimientos entre llamadas.
function installFetch(initial: Transaction[]) {
  let list = [...initial]
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url.includes("/categories")) return json(200, [])
    if (url.includes("/transactions")) {
      const deleteId = url.match(/\/transactions\/([^?]+)/)?.[1]
      if (method === "GET") return json(200, list)
      if (method === "POST") {
        const body = JSON.parse(init!.body as string)
        const created = tx({ ...body, id: `t${list.length + 1}`, category: null })
        list = [created, ...list]
        return json(201, created)
      }
      if (method === "DELETE" && deleteId) {
        list = list.filter((t) => t.id !== deleteId)
        return json(204, null)
      }
    }
    return json(404, { detail: "not found" })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/movimientos"]}>
      <AuthProvider>
        <Transactions />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

beforeEach(() => localStorage.clear())

describe("Transactions", () => {
  it("muestra el histórico de movimientos", async () => {
    installFetch([tx({ id: "t1", concept: "Mercadona", amount: "42.90" })])
    renderPage()
    expect(await screen.findByText("Mercadona")).toBeInTheDocument()
    expect(screen.getByText("−42.90 €")).toBeInTheDocument()
  })

  it("muestra un estado vacío sin movimientos", async () => {
    installFetch([])
    renderPage()
    expect(await screen.findByText(/Aún no tienes movimientos/)).toBeInTheDocument()
  })

  it("crea un movimiento desde el diálogo y lo muestra en la lista", async () => {
    const fetchMock = installFetch([])
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(/Aún no tienes movimientos/)
    await user.click(screen.getByRole("button", { name: "Añadir movimiento" }))

    await user.type(await screen.findByLabelText("Importe (€)"), "15.50")
    await user.type(screen.getByLabelText("Concepto"), "Farmacia")
    await user.click(screen.getByRole("button", { name: "Guardar movimiento" }))

    expect(await screen.findByText("Farmacia")).toBeInTheDocument()

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit)?.method === "POST",
    )
    const body = JSON.parse((postCall![1] as RequestInit).body as string)
    expect(body).toMatchObject({ type: "expense", concept: "Farmacia" })
    expect(Number(body.amount)).toBe(15.5)
  })

  it("borra un movimiento tras confirmar", async () => {
    installFetch([tx({ id: "t1", concept: "Gimnasio" })])
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const user = userEvent.setup()
    renderPage()

    const row = (await screen.findByText("Gimnasio")).closest("tr")!
    await user.click(within(row).getByRole("button", { name: "Borrar" }))

    await waitFor(() => expect(screen.queryByText("Gimnasio")).not.toBeInTheDocument())
  })
})
