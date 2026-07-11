import { expect, test } from "@playwright/test"

// Flujo real: registro → crear ingreso, gasto y un "no computable" (transfer) →
// /analisis → el neto = ingresos − gastos y el transfer NO cuenta.

const API = "http://localhost:8000/api/v1"
const today = new Date().toISOString().slice(0, 10)

function uniqueUser() {
  const s = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return { nickname: `ana${s}`, email: `ana${s}@mail.com`, password: "Str0ng!Pass" }
}

test("análisis: ingresos vs gastos excluye lo no computable", async ({ page }) => {
  const u = uniqueUser()
  await page.goto("/register")
  await page.getByLabel("Nick").fill(u.nickname)
  await page.getByLabel("Email").fill(u.email)
  await page.getByLabel("Contraseña", { exact: true }).fill(u.password)
  await page.getByLabel("Repetir contraseña").fill(u.password)
  await page.getByRole("button", { name: "Registrarme" }).click()
  await page.getByRole("link", { name: "Ver movimientos" }).click()

  // Crear movimientos vía API (ingreso 1000, gasto 300, transfer 500).
  await page.evaluate(
    async ({ API, today }) => {
      const t = localStorage.getItem("numario.access")
      const h = { "Content-Type": "application/json", Authorization: `Bearer ${t}` }
      const mk = (amount: string, type: string, concept: string) =>
        fetch(`${API}/transactions`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ amount, type, concept, occurred_on: today }),
        })
      await mk("1000.00", "income", "Nomina")
      await mk("300.00", "expense", "Compra")
      await mk("500.00", "transfer", "Traspaso")
    },
    { API, today },
  )

  await page.getByRole("link", { name: "Análisis" }).first().click()
  await expect(page.getByRole("heading", { name: "Análisis" })).toBeVisible()

  // Neto = 1000 − 300 = 700 (el transfer de 500 no cuenta).
  await expect(page.getByTestId("net")).toContainText("700,00")
  await expect(page.getByTestId("expense")).toContainText("300,00")
})
