import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import ResetPassword from "@/pages/ResetPassword"

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: async () => body } as Response
}

function renderPage(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route path="/forgot-password" element={<div>FORGOT</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ResetPassword", () => {
  it("sin token muestra el aviso y no pinta el formulario", () => {
    vi.stubGlobal("fetch", vi.fn())
    renderPage("/reset-password")
    expect(screen.getByText(/El enlace no es válido/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument()
  })

  it("cambia la contraseña y redirige a login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(204, null))
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderPage("/reset-password?token=abc123")

    await user.type(screen.getByLabelText("Contraseña"), "Str0ng!Pass")
    await user.type(screen.getByLabelText("Repetir contraseña"), "Str0ng!Pass")
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }))

    await waitFor(() => expect(screen.getByText("LOGIN")).toBeInTheDocument())
    const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/auth/reset-password"))
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
      token: "abc123",
      new_password: "Str0ng!Pass",
    })
  })

  it("no permite enviar si las contraseñas no coinciden", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderPage("/reset-password?token=abc123")

    await user.type(screen.getByLabelText("Contraseña"), "Str0ng!Pass")
    await user.type(screen.getByLabelText("Repetir contraseña"), "Str0ng!Otra")
    expect(screen.getByText("Las contraseñas no coinciden")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("muestra el error de la API si el token no es válido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, { detail: "El enlace no es válido o ha caducado. Pide uno nuevo." }),
      ),
    )
    const user = userEvent.setup()
    renderPage("/reset-password?token=caducado")

    await user.type(screen.getByLabelText("Contraseña"), "Str0ng!Pass")
    await user.type(screen.getByLabelText("Repetir contraseña"), "Str0ng!Pass")
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/no es válido o ha caducado/)
  })
})
