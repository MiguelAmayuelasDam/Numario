import { expect, test, type Page } from "@playwright/test"

// Happy path del dashboard: carga con sus tarjetas y, al pulsar un mes del
// resumen de 6 meses, navega a Análisis.

function uniqueUser() {
  const s = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return { nickname: `db${s}`, email: `db${s}@mail.com`, password: "Str0ng!Pass" }
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

test("dashboard: carga y un mes del resumen lleva a Análisis", async ({ page }) => {
  await register(page)

  // Tras el registro se aterriza en el dashboard (/).
  await expect(page.getByTestId("dash-net")).toBeVisible()
  await expect(page.getByText(/Cómo llevas tu/)).toBeVisible()
  await expect(page.getByRole("heading", { name: "Colchón de emergencia" })).toBeVisible()

  // Pulsar el mes más reciente del resumen de 6 meses → Análisis.
  await page.getByTitle(/en Análisis/).last().click()
  await expect(page.getByRole("heading", { name: "Análisis" })).toBeVisible()
})
