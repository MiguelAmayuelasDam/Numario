import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api, tokenStore } from "./api"

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  } as Response

}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

beforeEach(() => {
  localStorage.clear()
})

describe("api client", () => {
  it("inyecta la cabecera Authorization en peticiones autenticadas", async () => {
    tokenStore.set({ access_token: "ACC", refresh_token: "REF", token_type: "bearer" })
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { id: "1", email: "a@b.com", nickname: "nick" }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await api.me()

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe("Bearer ACC")
  })

  it("reintenta con refresh cuando el access token caduca (401)", async () => {
    tokenStore.set({ access_token: "OLD", refresh_token: "REF", token_type: "bearer" })

    const fetchMock = vi
      .fn()
      // 1) /auth/me con token viejo → 401
      .mockResolvedValueOnce(jsonResponse(401, { detail: "expired" }))
      // 2) /auth/refresh → nuevo par
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: "NEW", refresh_token: "REF2", token_type: "bearer" }),
      )
      // 3) /auth/me reintentado → 200
      .mockResolvedValueOnce(jsonResponse(200, { id: "1", email: "a@b.com", nickname: "nick" }))
    vi.stubGlobal("fetch", fetchMock)

    const user = await api.me()

    expect(user.nickname).toBe("nick")
    expect(fetchMock).toHaveBeenCalledTimes(3)
    // El token se ha actualizado tras el refresh.
    expect(tokenStore.getAccess()).toBe("NEW")
    // El reintento usa el token nuevo.
    const [, retryInit] = fetchMock.mock.calls[2]
    expect(retryInit.headers.Authorization).toBe("Bearer NEW")
  })

  it("lanza ApiError con el detalle del backend en errores", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { detail: "Ese nick ya está en uso" })))
    await expect(api.register("a@b.com", "nick", "Str0ng!Pass")).rejects.toThrow(
      "Ese nick ya está en uso",
    )
  })
})
