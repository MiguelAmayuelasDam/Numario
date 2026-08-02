import { expect, test, type Page } from "@playwright/test"

// Camino feliz de la cartera: registro → crear activos → poner un total → ver el
// reparto calculado → marcar una aportación como hecha → verla en Movimientos.

function uniqueUser() {
  const s = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return { nickname: `inv${s}`, email: `inv${s}@mail.com`, password: "Str0ng!Pass" }
}

async function register(page: Page): Promise<void> {
  const u = uniqueUser()
  await page.goto("/register")
  await page.getByLabel("Nick").fill(u.nickname)
  await page.getByLabel("Email").fill(u.email)
  await page.getByLabel("Contraseña", { exact: true }).fill(u.password)
  await page.getByLabel("Repetir contraseña").fill(u.password)
  await page.getByRole("button", { name: "Registrarme" }).click()
  await expect(page.getByTestId("user-nickname")).toHaveText(u.nickname)
}

async function addAsset(page: Page, name: string, weight: string): Promise<void> {
  await page.getByRole("button", { name: "Añadir activo" }).click()
  await page.getByLabel("Nombre").fill(name)
  // El peso tiene barra + campo exacto; se teclea el valor en el campo.
  await page.getByLabel("Peso exacto").fill(weight)
  await page.getByRole("button", { name: "Guardar" }).click()
  // El nombre aparece en la lista y en la leyenda del donut: basta con que exista.
  await expect(page.getByText(name).first()).toBeVisible()
}

test("cartera: crear activos, calcular el reparto y aportar", async ({ page }) => {
  await register(page)

  await page.goto("/cartera")
  await expect(page.getByRole("heading", { name: "Cartera" })).toBeVisible()
  await expect(page.getByText(/Aún no tienes cartera/)).toBeVisible()

  await addAsset(page, "ETF World", "60")
  await addAsset(page, "ETF SP500", "40")

  // Total 1000 → reparto 600 / 400 (100% variable por defecto).
  await page.getByLabel("A invertir este mes (€)").fill("1000")
  await expect(page.getByText("600,00 €").first()).toBeVisible()
  await expect(page.getByText("400,00 €").first()).toBeVisible()

  // Marcar el primero como hecho.
  await page.getByRole("button", { name: /Marcar ETF World/ }).click()
  await expect(page.getByText("aportado")).toBeVisible()

  // La aportación aparece en Movimientos como traspaso.
  await page.getByRole("link", { name: "Movimientos" }).click()
  await expect(page.getByText(/Aportación · ETF World/)).toBeVisible()
})
