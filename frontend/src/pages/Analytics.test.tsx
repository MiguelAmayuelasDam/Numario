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
  is_current: true,
  income_base: "1000.00",
  summary: { income: "1000.00", expense: "300.00", net: "700.00" },
  buckets: [
    { bucket: "living", label: "Vida", budget: "500.00", spent: "100.00", pct: 20, status: "ok" },
    { bucket: "monthly", label: "Mes", budget: "300.00", spent: "60.00", pct: 20, status: "ok" },
    { bucket: "investment", label: "Inversión", budget: "200.00", spent: "0.00", pct: 0, status: "ok" },
  ],
  categories: [
    { category_id: "c1", name: "Restaurante", emoji: "🍕", bucket: "monthly", spent: "200.00", forecast: "50.00" },
    { category_id: "c2", name: "Supermercado", emoji: "🛒", bucket: "living", spent: "100.00", forecast: null },
  ],
}

const SERIES = [
  { label: "JUN", year: 2026, month: 6, income: "800.00", expense: "400.00" },
  { label: "JUL", year: 2026, month: 7, income: "1000.00", expense: "300.00" },
]

function installFetch() {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.includes("/analytics/overview")) return json(200, OVERVIEW)
    if (url.includes("/analytics/series")) return json(200, SERIES)
    if (url.includes("/budget/income")) return json(204, null)
    if (url.includes("/budget")) return json(200, { monthly_income: "1000.00", living_pct: 50, monthly_pct: 30, investment_pct: 20 })
    if (url.includes("/forecast")) return json(204, null)
    return json(404, {})
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderPage(entry = "/analisis") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Analytics />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

beforeEach(() => {
  localStorage.setItem("numario.access", "ACC")
  // Fecha fija (julio 2026, la del mock de overview) para que el test no dependa
  // de cuándo se ejecute: el componente usa new Date() para el mes del ingreso, y
  // con la fecha real (p. ej. agosto) el ajuste iba a otro mes. Se falsea solo
  // `Date` para no tocar setTimeout/setInterval (que usan waitFor y userEvent).
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-07-15T12:00:00"))
})

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

  it("permite editar el previsto en el mes en curso y lo guarda", async () => {
    const fetchMock = installFetch()
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("Restaurante")

    const input = screen.getByLabelText("Previsto de Restaurante")
    await user.clear(input)
    await user.type(input, "80")
    await user.tab() // blur → guarda

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([u, init]) =>
          (u as string).includes("/forecast") && (init as RequestInit)?.method === "PUT",
      )
      expect(putCall).toBeTruthy()
      expect(JSON.parse((putCall![1] as RequestInit).body as string)).toMatchObject({
        category_id: "c1",
        amount: "80",
      })
    })
  })

  it("ajusta el ingreso del mes desde 'Ajustar presupuesto'", async () => {
    const fetchMock = installFetch()
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("Reparto 50-30-20")

    await user.click(screen.getByRole("button", { name: "Ajustar presupuesto" }))
    const income = await screen.findByLabelText(/Ingreso de julio 2026/)
    await user.clear(income)
    await user.type(income, "1800")
    await user.click(screen.getByRole("button", { name: "Guardar" }))

    await waitFor(() => {
      const putIncome = fetchMock.mock.calls.find(
        ([u, init]) =>
          (u as string).includes("/budget/income") &&
          (init as RequestInit)?.method === "PUT",
      )
      expect(putIncome).toBeTruthy()
      expect(JSON.parse((putIncome![1] as RequestInit).body as string)).toMatchObject({
        year: 2026,
        month: 7,
        amount: "1800",
      })
    })
  })

  it("abre el periodo indicado en la URL (?year&month)", async () => {
    const fetchMock = installFetch()
    renderPage("/analisis?granularity=month&year=2026&month=3")
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([u]) => u as string)
      expect(
        calls.some(
          (u) =>
            u.includes("/analytics/overview") && u.includes("year=2026") && u.includes("month=3"),
        ),
      ).toBe(true)
    })
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

  describe("sin ingreso configurado (usuario nuevo)", () => {
    // Ya ha metido gastos pero nunca ha dicho cuánto ingresa: no hay
    // presupuesto contra el que comparar.
    const SIN_INGRESO = {
      ...OVERVIEW,
      income_base: "0.00",
      summary: { income: "2400.00", expense: "2000.00", net: "400.00" },
      buckets: [
        { bucket: "living", label: "Vida", budget: "0.00", spent: "2000.00", pct: 0, status: "unset" },
        { bucket: "monthly", label: "Mes", budget: "0.00", spent: "0.00", pct: 0, status: "unset" },
        { bucket: "investment", label: "Inversión", budget: "0.00", spent: "0.00", pct: 0, status: "unset" },
      ],
    }

    function installSinIngreso() {
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes("/analytics/overview")) return json(200, SIN_INGRESO)
        if (url.includes("/analytics/series")) return json(200, SERIES)
        if (url.includes("/budget/income")) return json(204, null)
        if (url.includes("/budget"))
          return json(200, { monthly_income: "0.00", living_pct: 50, monthly_pct: 30, investment_pct: 20 })
        return json(404, {})
      })
      vi.stubGlobal("fetch", fetchMock)
      return fetchMock
    }

    it("avisa de que no hay con qué comparar y ofrece configurarlo", async () => {
      installSinIngreso()
      renderPage()

      expect(await screen.findByTestId("no-income")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Configurar ingreso" })).toBeInTheDocument()
    })

    it("no dice '0,00 € / 0,00 €', que se leería como que no has gastado", async () => {
      installSinIngreso()
      renderPage()
      await screen.findByTestId("no-income")

      // Lo gastado sí lo sabemos; el límite es lo que falta. Uno por cubo.
      expect(screen.getAllByText(/sin límite fijado/)).toHaveLength(3)
      expect(screen.queryByText("0,00 € / 0,00 €")).not.toBeInTheDocument()
    })

    it("propone el ingreso detectado en el periodo, ya escrito", async () => {
      installSinIngreso()
      const user = userEvent.setup()
      renderPage()
      await screen.findByTestId("no-income")

      await user.click(screen.getByRole("button", { name: "Configurar ingreso" }))

      // 2400 = lo ingresado según los movimientos, no el 0 configurado.
      const campo = await screen.findByLabelText(/Ingreso de julio 2026/)
      expect(campo).toHaveValue(2400)
      expect(screen.getByText(/Te proponemos lo que has ingresado/)).toBeInTheDocument()
    })

    it("marca 'ingreso habitual' por defecto, para que arregle todos los meses", async () => {
      installSinIngreso()
      const user = userEvent.setup()
      renderPage()
      await screen.findByTestId("no-income")

      await user.click(screen.getByRole("button", { name: "Configurar ingreso" }))

      // Sin esto, un solo Guardar arreglaría julio y en agosto volvería a ver
      // las barras vacías.
      expect(await screen.findByLabelText(/ingreso habitual/i)).toBeChecked()
    })

    it("no toca la casilla del habitual a quien ya tiene ingreso configurado", async () => {
      installFetch() // OVERVIEW normal: income_base 1000
      const user = userEvent.setup()
      renderPage()
      await screen.findByTestId("income")

      await user.click(screen.getByRole("button", { name: "Ajustar presupuesto" }))

      expect(await screen.findByLabelText(/ingreso habitual/i)).not.toBeChecked()
      expect(screen.queryByText(/Te proponemos lo que has ingresado/)).not.toBeInTheDocument()
    })
  })
})
