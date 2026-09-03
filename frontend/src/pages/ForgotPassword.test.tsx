import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import ForgotPassword from "@/pages/ForgotPassword"

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: async () => body } as Response
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/forgot-password"]}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ForgotPassword", () => {
  it("envía el email y muestra la confirmación", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { detail: "ok" }))
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText("Email"), "ana@mail.com")
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }))

    await waitFor(() => expect(screen.getByText("Revisa tu correo")).toBeInTheDocument())
    const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/auth/forgot-password"))
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ email: "ana@mail.com" })
  })

  it("no llama a la API con el email vacío", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: "Enviar enlace" }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("muestra la confirmación aunque la API falle (no filtra nada)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")))
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText("Email"), "x@mail.com")
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }))

    expect(await screen.findByText("Revisa tu correo")).toBeInTheDocument()
  })
})
