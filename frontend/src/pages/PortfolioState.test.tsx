import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import PortfolioState from "@/pages/PortfolioState"

function json(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const group = (id: string, name: string) => ({
  id,
  name,
  weight: "100",
  variable_pct: "90",
  fixed_pct: "10",
})

const row = (id: string, name: string, groupId: string | null, total: string) => ({
  asset: { id, name, asset_class: "variable", kind: "etf", weight: "100", group_id: groupId, active: true },
  planned: "0.00",
  contributed: "0.00",
  done: false,
  total_contributed: total,
})

const contrib = (id: string, assetId: string, concept: string, amount: string, date: string) => ({
  id,
  asset_id: assetId,
  concept,
  amount,
  occurred_on: date,
})

function installFetch(
  rows: unknown[],
  groups: unknown[],
  historyByAsset: Record<string, unknown[]> = {},
) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/investment/groups")) return json(200, groups)
    if (url.includes("/investment/history")) {
      const m = url.match(/asset_id=([^&]+)/)
      return json(200, m ? (historyByAsset[m[1]] ?? []) : [])
    }
    if (url.includes("/investment/status")) return json(200, rows)
    return json(404, {})
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/cartera/estado"]}>
      <PortfolioState />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

beforeEach(() => localStorage.setItem("numario.access", "ACC"))

const GROUPS = [group("g1", "IB"), group("g2", "MyInvestor")]
const ROWS = [row("1", "SXR8", "g1", "300.00"), row("2", "BND", "g2", "100.00")]
const HISTORY = {
  "1": [contrib("h1", "1", "Aportación · SXR8", "300.00", "2026-05-10")],
  "2": [contrib("h2", "2", "Aportación extra · BND", "100.00", "2026-06-10")],
}

describe("PortfolioState", () => {
  it("muestra el total invertido, el donut y el detalle del activo", async () => {
    installFetch(ROWS, GROUPS, HISTORY)
    renderPage()

    await screen.findByText("Aportado por activo")
    // Total invertido = 300 + 100.
    expect(screen.getByText("400,00 €")).toBeInTheDocument()
    // Donut con el peso real de cada activo (300/400 = 75%).
    expect(screen.getByText("75.0%")).toBeInTheDocument()
    expect(screen.getAllByText("SXR8").length).toBeGreaterThanOrEqual(1)
    // Por defecto se elige el más aportado (SXR8); su detalle y su aportación cargan
    // de forma asíncrona (selección → historial), así que se esperan con findByText.
    expect(await screen.findByText("+300,00 €")).toBeInTheDocument()
    expect(screen.getByText("300,00 €")).toBeInTheDocument()
  })

  it("filtra por grupo", async () => {
    const user = userEvent.setup()
    installFetch(ROWS, GROUPS, HISTORY)
    renderPage()
    await screen.findByText("Aportado por activo")

    await user.click(screen.getByRole("combobox", { name: "Filtrar por grupo" }))
    await user.click(screen.getByRole("option", { name: "MyInvestor" }))

    // Solo el activo de MyInvestor: su aportación (100), y SXR8 (de IB) desaparece.
    await waitFor(() => expect(screen.getByText("+100,00 €")).toBeInTheDocument())
    expect(screen.getAllByText("BND").length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText("SXR8")).not.toBeInTheDocument()
  })

  it("sin aportaciones, invita a empezar", async () => {
    installFetch([row("1", "SXR8", "g1", "0.00")], GROUPS)
    renderPage()

    expect(await screen.findByText(/Aún no has aportado nada/)).toBeInTheDocument()
  })

  it("abre el diálogo de aportación extra", async () => {
    const user = userEvent.setup()
    installFetch(ROWS, GROUPS, HISTORY)
    renderPage()
    await screen.findByText("Aportado por activo")

    await user.click(screen.getByRole("button", { name: "Aportación extra" }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })
})
