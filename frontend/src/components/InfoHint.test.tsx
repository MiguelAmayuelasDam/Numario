import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { InfoHint } from "@/components/InfoHint"
import { EmergencyFundHint, Rule503020Hint } from "@/components/hints"

afterEach(cleanup)

describe("InfoHint", () => {
  it("está oculto hasta que se pulsa el '?'", async () => {
    render(
      <InfoHint label="Qué es esto" title="Un título">
        <p>El cuerpo de la ayuda.</p>
      </InfoHint>,
    )
    // La ayuda no molesta hasta que se pide.
    expect(screen.queryByText("El cuerpo de la ayuda.")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Qué es esto" }))

    expect(screen.getByText("Un título")).toBeInTheDocument()
    expect(screen.getByText("El cuerpo de la ayuda.")).toBeInTheDocument()
  })
})

describe("hints", () => {
  it("la regla 50-30-20 nombra los tres cubos y su origen", async () => {
    render(<Rule503020Hint />)
    await userEvent.click(screen.getByRole("button", { name: "Qué es la regla 50-30-20" }))

    expect(screen.getByText(/Elizabeth Warren/)).toBeInTheDocument()
    expect(screen.getByText(/Vida/)).toBeInTheDocument()
    expect(screen.getByText(/Mes/)).toBeInTheDocument()
    expect(screen.getByText(/Inversión/)).toBeInTheDocument()
  })

  it("el colchón explica para qué sirve, no solo cuánto", async () => {
    render(<EmergencyFundHint />)
    await userEvent.click(screen.getByRole("button", { name: "Qué es el colchón de emergencia" }))

    expect(screen.getByText(/imprevistos/)).toBeInTheDocument()
    expect(screen.getByText(/3 a 6 meses/)).toBeInTheDocument()
  })
})
