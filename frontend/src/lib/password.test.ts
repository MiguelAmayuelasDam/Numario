import { describe, expect, it } from "vitest"

import { evaluatePassword } from "./password"

describe("evaluatePassword", () => {
  it("acepta una contraseña fuerte", () => {
    const result = evaluatePassword("Str0ng!Pass")
    expect(result.valid).toBe(true)
    expect(result.score).toBe(5)
  })

  it("detecta requisitos incumplidos", () => {
    const { checks } = evaluatePassword("weak")
    expect(checks.length).toBe(false)
    expect(checks.upper).toBe(false)
    expect(checks.digit).toBe(false)
    expect(checks.symbol).toBe(false)
  })

  it("rechaza contraseñas comunes", () => {
    const result = evaluatePassword("password123")
    expect(result.checks.notCommon).toBe(false)
    expect(result.valid).toBe(false)
  })

  it("rechaza contraseñas que contienen el nick", () => {
    const result = evaluatePassword("Miguel123!", { nickname: "miguel" })
    expect(result.checks.notIdentity).toBe(false)
    expect(result.valid).toBe(false)
  })

  it("rechaza contraseñas que contienen la parte local del email", () => {
    const result = evaluatePassword("Carlos123!", { email: "carlos@mail.com" })
    expect(result.checks.notIdentity).toBe(false)
  })
})
