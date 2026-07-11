import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import Analytics from "@/pages/Analytics"

function json(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: async () => body } as Response
}

const OVERVIEW = {
  period_label: "julio 2026",
  date_from: "2026-07-01",
  date_to: "2026-07-31",
  summary: { income: "1000.00", expense: "300.00", net: "700.00" },
  buckets: [
    { bucket: "living", label: "Vida", budget: "500.00", spent: "100.00", pct: 20, status: "ok" },
    { bucket: "monthly", label: "Mes", budget: "300.00", spent: "60.00", pct: 20, status: "ok" },
    { bucket: "investment", label: "Inversión", budget: "200.00", spent: "0.00", pct: 0, status: "ok" },
  ],
  categories: [
    { category_id: "c1", name: "Restaurante", emoji: "🍕", bucket: "monthly", spent: "200.00" },
    { category_id: "c2", name: "Supermercado", emoji: "🛒", bucket: "living", spent: "100.00" },
  ],
}

const SERIES = [
  { label: "JUN", year: 2026, month: 6, income: "800.00", expense: "400.00" },
  { label: "JUL", year: 2026, month: 7, income: "1000.00", expense: "300.00" },
]

function installFetch() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/analytics/overview")) return json(200, OVERVIEW)
    if (url.includes("/analytics/series")) return json(200, SERIES)
    if (url.includes("/budget")) return json(200, { monthly_income: "1000.00", living_pct: 50, monthly_pct: 30, investment_pct: 20 })
    return json(404, {})
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/analisis"]}>
      <Analytics />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

beforeEach(() => localStorage.setItem("numario.access", "ACC"))

describe("Analytics", () => {
  it("muestra ingresos, gastos y neto", async () => {
    installFetch()
    renderPage()
    // El separador de miles depende del ICU (jsdom: "1000,00"; navegador: "1.000,00").
    await waitFor(() => expect(screen.getByTestId("income")).toHaveTextContent(/1\.?000,00/))
    expect(screen.getByTestId("expense")).toHaveTextContent("300,00")
    expect(screen.getByTestId("net")).toHaveTextContent("700,00")
  })

  it("muestra el reparto 50-30-20 y el desglose por categoría", async () => {
    installFetch()
    renderPage()
    await screen.findByText("Reparto 50-30-20")
    expect(screen.getByText("Vida")).toBeInTheDocument()
    // Categorías ordenadas: Restaurante (200) antes que Supermercado (100).
    expect(await screen.findByText("Restaurante")).toBeInTheDocument()
    expect(screen.getByText("Supermercado")).toBeInTheDocument()
  })

  it("cambia a periodo anual y refetcha", async () => {
    const fetchMock = installFetch()
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId("income")

    await user.click(screen.getByRole("button", { name: "Años" }))
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([u]) => u as string)
      expect(calls.some((u) => u.includes("granularity=year"))).toBe(true)
    })
  })
})
