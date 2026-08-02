import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import Portfolio from "@/pages/Portfolio"

function json(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const asset = (id: string, name: string, cls: string, weight: string, group: string | null = null) => ({
  id,
  name,
  asset_class: cls,
  kind: "etf",
  weight,
  group_id: group,
  active: true,
})

const MONTH = [
  { asset: asset("1", "ETF World", "variable", "60"), planned: "480.00", contributed: "0.00", done: false },
  { asset: asset("2", "ETF SP", "variable", "40"), planned: "320.00", contributed: "0.00", done: false },
  { asset: asset("3", "Fondo RF", "fija", "100"), planned: "200.00", contributed: "0.00", done: false },
]

function installFetch(month = MONTH, groups: unknown[] = []) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/investment/allocation")) return json(200, { variable_pct: 80, fixed_pct: 20 })
    if (url.includes("/investment/groups")) return json(200, groups)
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

    await screen.findAllByText("ETF World")  // en la lista y en la leyenda del donut
    expect(screen.getAllByText("ETF World").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("480,00 €")).toBeInTheDocument()
    expect(screen.getByText("320,00 €")).toBeInTheDocument()
    // El contador refleja cuántos van hechos.
    expect(screen.getByText(/0\/3 hecho/)).toBeInTheDocument()
  })

  it("empuja la aportación al backend al marcar como hecho", async () => {
    const fetchMock = installFetch()
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByText("ETF World")

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

  it("sin cartera, invita a empezar", async () => {
    installFetch([])
    renderPage()

    expect(await screen.findByText(/Aún no tienes cartera/)).toBeInTheDocument()
  })

  it("pinta los activos bajo la cabecera de su grupo", async () => {
    const groups = [{ id: "g1", name: "Crecimiento", asset_class: "variable", weight: "70" }]
    const month = [
      { asset: asset("1", "SXR8", "variable", "30", "g1"), planned: "189.00", contributed: "0.00", done: false },
    ]
    installFetch(month, groups)
    renderPage()

    expect(await screen.findByText("Crecimiento")).toBeInTheDocument()
    // SXR8 aparece en la lista del grupo y en la leyenda del donut.
    expect(screen.getAllByText("SXR8").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("189,00 €")).toBeInTheDocument()
  })

  it("el donut muestra el peso efectivo de cada activo", async () => {
    const groups = [{ id: "g1", name: "Crecimiento", asset_class: "variable", weight: "50" }]
    // 80% variable · grupo 50% · activo 100% → efectivo 40% del total.
    const month = [
      { asset: asset("1", "SXR8", "variable", "100", "g1"), planned: "0.00", contributed: "0.00", done: false },
    ]
    installFetch(month, groups)
    renderPage()

    await screen.findByText("Reparto por activo")
    expect(screen.getByText("40.0%")).toBeInTheDocument()
    // El 60% restante queda sin asignar.
    expect(screen.getByText("Sin asignar")).toBeInTheDocument()
  })
})
