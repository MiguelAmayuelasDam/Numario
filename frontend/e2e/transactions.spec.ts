import { expect, test } from "@playwright/test"

// Flujo real de gestión de movimientos contra el stack de docker compose:
// registro → ir a movimientos → añadir un movimiento → verlo en el listado.

function uniqueUser() {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return {
    nickname: `mov${suffix}`,
    email: `mov${suffix}@mail.com`,
    password: "Str0ng!Pass",
  }
}

test("registro y alta de un movimiento", async ({ page }) => {
  const user = uniqueUser()

  // Registro (auto-login → dashboard).
  await page.goto("/register")
  await page.getByLabel("Nick").fill(user.nickname)
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Contraseña", { exact: true }).fill(user.password)
  await page.getByLabel("Repetir contraseña").fill(user.password)
  await page.getByRole("button", { name: "Registrarme" }).click()

  // Ir a movimientos.
  await page.getByRole("link", { name: "Ver movimientos" }).click()
  await expect(page.getByRole("heading", { name: "Movimientos" })).toBeVisible()
  await expect(page.getByText(/No hay movimientos/)).toBeVisible()

  // Alta de un movimiento.
  await page.getByRole("button", { name: "Añadir movimiento" }).click()
  await page.getByLabel("Importe (€)").fill("42.90")
  await page.getByLabel("Concepto").fill("Mercadona")
  await page.getByRole("button", { name: "Guardar movimiento" }).click()

  // Aparece en el listado con el importe formateado (es-ES).
  await expect(page.getByText("Mercadona")).toBeVisible()
  await expect(page.getByText(/42,90\s*€/)).toBeVisible()
})
