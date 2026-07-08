import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AuthProvider } from "@/context/AuthContext"
import { tokenStore } from "@/lib/api"

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: async () => body } as Response
}

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>PRIVATE</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>LOGIN PAGE</div>} />
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

describe("ProtectedRoute", () => {
  it("redirige a /login cuando no hay sesión", async () => {
    vi.stubGlobal("fetch", vi.fn())
    renderProtected()
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument()
    expect(screen.queryByText("PRIVATE")).not.toBeInTheDocument()
  })

  it("deja pasar cuando hay sesión válida", async () => {
    tokenStore.set({ access_token: "ACC", refresh_token: "REF", token_type: "bearer" })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { id: "1", email: "a@b.com", nickname: "nick" })),
    )
    renderProtected()
    expect(await screen.findByText("PRIVATE")).toBeInTheDocument()
  })
})
