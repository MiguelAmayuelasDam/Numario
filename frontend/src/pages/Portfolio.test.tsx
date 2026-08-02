import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import Portfolio from "@/pages/Portfolio"

function json(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const asset = (id: string, name: string, cls: string, weight: string) => ({
  id,
  name,
  asset_class: cls,
  kind: "etf",
  weight,
  active: true,
})

const MONTH = [
  { asset: asset("1", "ETF World", "variable", "60"), planned: "480.00", contributed: "0.00", done: false },
  { asset: asset("2", "ETF SP", "variable", "40"), planned: "320.00", contributed: "0.00", done: false },
  { asset: asset("3", "Fondo RF", "fija", "100"), planned: "200.00", contributed: "0.00", done: false },
]

function installFetch(month = MONTH) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/investment/allocation")) return json(200, { variable_pct: 80, fixed_pct: 20 })
    if (url.includes("/investment/month")) return json(200, month)
    if (url.includes("/investment/contributions") && init?.method === "POST")
      return json(201, { id: "t1", amount: "480.00", type: "transfer" })
    return json(404, {})
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/cartera"]}>
      <Portfolio />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

beforeEach(() => localStorage.setItem("numario.access", "ACC"))

describe("Portfolio", () => {
  it("muestra los activos con su reparto previsto", async () => {
    installFetch()
    renderPage()

    expect(await screen.findByText("ETF World")).toBeInTheDocument()
    expect(screen.getByText("480,00 €")).toBeInTheDocument()
    expect(screen.getByText("320,00 €")).toBeInTheDocument()
    // El contador refleja cuántos van hechos.
    expect(screen.getByText(/0\/3 hecho/)).toBeInTheDocument()
  })

  it("empuja la aportación al backend al marcar como hecho", async () => {
    const fetchMock = installFetch()
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("ETF World")

    await user.click(screen.getByRole("button", { name: /Marcar ETF World/ }))

    await waitFor(() => {
      const posted = fetchMock.mock.calls.some(
        ([url, init]) =>
          (url as string).includes("/investment/contributions") &&
          (init as RequestInit | undefined)?.method === "POST",
      )
      expect(posted).toBe(true)
    })
  })

  it("un activo ya aportado sale marcado y con 'aportado'", async () => {
    installFetch([
      { asset: asset("1", "ETF World", "variable", "60"), planned: "480.00", contributed: "480.00", done: true },
    ])
    renderPage()

    expect(await screen.findByText("aportado")).toBeInTheDocument()
    expect(screen.getByText(/1\/1 hecho/)).toBeInTheDocument()
  })

  it("sin activos, invita a añadir el primero", async () => {
    installFetch([])
    renderPage()

    expect(await screen.findByText(/Aún no tienes activos/)).toBeInTheDocument()
  })
})
