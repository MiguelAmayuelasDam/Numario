import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import App from "./App"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("App", () => {
  it("muestra el título de la aplicación", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    render(<App />)
    expect(screen.getByRole("heading", { name: "Numario" })).toBeInTheDocument()
  })

  it("marca el backend como 'ok' cuando /health responde correctamente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) }),
    )
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId("backend-status")).toHaveTextContent("ok")
    })
  })

  it("marca el backend como 'sin conexión' cuando fetch falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")))
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId("backend-status")).toHaveTextContent("sin conexión")
    })
  })
})
