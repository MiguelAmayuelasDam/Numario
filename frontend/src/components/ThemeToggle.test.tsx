import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ThemeToggle } from "@/components/ThemeToggle"
import { ThemeProvider } from "@/context/ThemeContext"

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.classList.remove("dark")
})

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove("dark")
})

describe("ThemeToggle", () => {
  it("alterna entre claro y oscuro y lo persiste", async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )
    const user = userEvent.setup()

    // Por defecto claro (matchMedia mockeado a matches:false).
    expect(document.documentElement.classList.contains("dark")).toBe(false)

    await user.click(screen.getByRole("button", { name: /modo oscuro/i }))
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("numario.theme")).toBe("dark")

    await user.click(screen.getByRole("button", { name: /modo claro/i }))
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(localStorage.getItem("numario.theme")).toBe("light")
  })
})
