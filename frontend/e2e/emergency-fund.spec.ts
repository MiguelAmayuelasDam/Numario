import { expect, test, type Page } from "@playwright/test"

// Happy path del colchón: registro → definir gasto mensual → añadir una
// aportación → ver el progreso reflejado.

function uniqueUser() {
  const s = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return { nickname: `ef${s}`, email: `ef${s}@mail.com`, password: "Str0ng!Pass" }
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

test("colchón: definir gasto mensual y añadir una aportación", async ({ page }) => {
  await register(page)

  await page.goto("/colchon")
  await expect(page.getByRole("heading", { name: "Colchón de emergencia" })).toBeVisible()
  // Espera a que termine la carga inicial (en dev, StrictMode la dispara 2 veces)
  // para que el valor tecleado no se resetee.
  await page.waitForLoadState("networkidle")

  // Usuario nuevo sin objetivo: en vez del hueco "0 € de 0 €", la explicación.
  await expect(page.getByTestId("ef-empty")).toBeVisible()

  // Gasto mensual 1000 × 6 meses (por defecto) → objetivo 6000.
  const need = page.getByLabel("Gasto mensual para vivir (€)")
  await need.fill("1000")
  await expect(need).toHaveValue("1000")
  await page.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(/6\.?000,00/).first()).toBeVisible()

  // Con objetivo definido, la explicación del estado vacío ya no estorba.
  await expect(page.getByTestId("ef-empty")).toBeHidden()

  // Aportación de 500.
  await page.getByRole("button", { name: "Añadir monto" }).click()
  await page.getByLabel("Cantidad (€)").fill("500")
  await page.getByRole("button", { name: "Añadir" }).click()

  await expect(page.getByTestId("ef-saved")).toContainText(/500,00/)
  await expect(page.getByText(/Te faltan/)).toBeVisible()
})
