import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TransactionForm } from "@/components/TransactionForm"

afterEach(cleanup)

function renderForm(onSubmit = vi.fn()) {
  render(
    <TransactionForm categories={[]} submitting={false} error={null} onSubmit={onSubmit} />,
  )
  return onSubmit
}

describe("TransactionForm", () => {
  it("mantiene el envío deshabilitado sin importe válido", async () => {
    renderForm()
    const submit = screen.getByRole("button", { name: "Guardar movimiento" })
    expect(submit).toBeDisabled()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Importe (€)"), "0")
    await user.type(screen.getByLabelText("Concepto"), "Prueba")
    expect(submit).toBeDisabled()
  })

  it("bloquea el envío si falta el concepto", async () => {
    renderForm()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Importe (€)"), "20.00")
    expect(screen.getByRole("button", { name: "Guardar movimiento" })).toBeDisabled()
  })

  it("envía el movimiento con datos válidos", async () => {
    const onSubmit = renderForm()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Importe (€)"), "42.90")
    await user.type(screen.getByLabelText("Concepto"), "Mercadona")
    await user.click(screen.getByRole("button", { name: "Guardar movimiento" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const arg = onSubmit.mock.calls[0][0]
    expect(arg).toMatchObject({ type: "expense", concept: "Mercadona", category_id: null })
    // El input numérico normaliza el string ("42.90" -> "42.9"); el backend lo
    // cuantiza a 2 decimales. Comparamos el valor, no el formato exacto.
    expect(Number(arg.amount)).toBe(42.9)
    expect(arg.occurred_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
