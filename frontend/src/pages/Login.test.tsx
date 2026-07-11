import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/context/AuthContext"
import Login from "@/pages/Login"

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: async () => body } as Response
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
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

describe("Login", () => {
  it("renderiza el formulario con el campo email o nick", () => {
    vi.stubGlobal("fetch", vi.fn())
    renderLogin()
    expect(screen.getByLabelText("Email o nick")).toBeInTheDocument()
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument()
  })

  it("hace login, guarda el token y navega al dashboard", async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.endsWith("/auth/login")) {
        return Promise.resolve(
          jsonResponse(200, { access_token: "ACC", refresh_token: "REF", token_type: "bearer" }),
        )
      }
      // /auth/me
      return Promise.resolve(jsonResponse(200, { id: "1", email: "a@b.com", nickname: "nick" }))
    })
    vi.stubGlobal("fetch", fetchMock)

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText("Email o nick"), "a@b.com")
    await user.type(screen.getByLabelText("Contraseña"), "Str0ng!Pass")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    await waitFor(() => expect(screen.getByText("DASHBOARD")).toBeInTheDocument())
    expect(localStorage.getItem("numario.access")).toBe("ACC")

    const loginCall = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/auth/login"))
    expect(JSON.parse((loginCall![1] as RequestInit).body as string)).toEqual({
      identifier: "a@b.com",
      password: "Str0ng!Pass",
    })
  })

  it("valida en cliente y no llama a la API con campos vacíos", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("Introduce tu email o nick.")).toBeInTheDocument()
    expect(screen.getByText("Introduce tu contraseña.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("muestra un error si las credenciales son inválidas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { detail: "Credenciales inválidas" })),
    )
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText("Email o nick"), "a@b.com")
    await user.type(screen.getByLabelText("Contraseña"), "malamala")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales inválidas")
  })
})
