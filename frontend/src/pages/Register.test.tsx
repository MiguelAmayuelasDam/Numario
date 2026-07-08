import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/context/AuthContext"
import Register from "@/pages/Register"

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: async () => body } as Response
}

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<div>DASHBOARD</div>} />
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

beforeEach(() => {
  localStorage.clear()
})

describe("Register", () => {
  it("mantiene el envío deshabilitado con contraseña débil", async () => {
    vi.stubGlobal("fetch", vi.fn())
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText("Nick"), "miguel")
    await user.type(screen.getByLabelText("Email"), "m@b.com")
    await user.type(screen.getByLabelText("Contraseña"), "weak")
    await user.type(screen.getByLabelText("Repetir contraseña"), "weak")

    expect(screen.getByRole("button", { name: "Registrarme" })).toBeDisabled()
  })

  it("bloquea el envío si las contraseñas no coinciden", async () => {
    vi.stubGlobal("fetch", vi.fn())
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText("Nick"), "miguel")
    await user.type(screen.getByLabelText("Email"), "m@b.com")
    await user.type(screen.getByLabelText("Contraseña"), "Str0ng!Pass")
    await user.type(screen.getByLabelText("Repetir contraseña"), "Str0ng!Different")

    expect(screen.getByRole("alert")).toHaveTextContent("no coinciden")
    expect(screen.getByRole("button", { name: "Registrarme" })).toBeDisabled()
  })

  it("registra con datos válidos y navega al dashboard", async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.endsWith("/auth/register")) {
        return Promise.resolve(jsonResponse(201, { id: "1", email: "m@b.com", nickname: "miguel" }))
      }
      if (url.endsWith("/auth/login")) {
        return Promise.resolve(
          jsonResponse(200, { access_token: "ACC", refresh_token: "REF", token_type: "bearer" }),
        )
      }
      return Promise.resolve(jsonResponse(200, { id: "1", email: "m@b.com", nickname: "miguel" }))
    })
    vi.stubGlobal("fetch", fetchMock)

    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText("Nick"), "miguel")
    await user.type(screen.getByLabelText("Email"), "m@b.com")
    await user.type(screen.getByLabelText("Contraseña"), "Str0ng!Pass")
    await user.type(screen.getByLabelText("Repetir contraseña"), "Str0ng!Pass")

    const button = screen.getByRole("button", { name: "Registrarme" })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)

    await waitFor(() => expect(screen.getByText("DASHBOARD")).toBeInTheDocument())

    const registerCall = fetchMock.mock.calls.find(([url]) =>
      (url as string).endsWith("/auth/register"),
    )
    expect(JSON.parse((registerCall![1] as RequestInit).body as string)).toEqual({
      email: "m@b.com",
      nickname: "miguel",
      password: "Str0ng!Pass",
    })
  })
})
