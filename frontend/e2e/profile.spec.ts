import { expect, test, type Page } from "@playwright/test"

// Happy path del perfil: registro → cambiar el nick → verlo reflejado en la
// barra superior.

function uniqueUser() {
  const s = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return { nickname: `pf${s}`, email: `pf${s}@mail.com`, password: "Str0ng!Pass", suffix: s }
}

test("perfil: cambiar el nick se refleja en la barra superior", async ({ page }) => {
  const u = uniqueUser()
  await page.goto("/register")
  await page.getByLabel("Nick").fill(u.nickname)
  await page.getByLabel("Email").fill(u.email)
  await page.getByLabel("Contraseña", { exact: true }).fill(u.password)
  await page.getByLabel("Repetir contraseña").fill(u.password)
  await page.getByRole("button", { name: "Registrarme" }).click()
  await expect(page.getByTestId("user-nickname")).toHaveText(u.nickname)

  // Ir a Mi perfil desde el submenú.
  await page.getByRole("button", { name: "Menú de perfil" }).click()
  await page.getByRole("link", { name: "Mi perfil" }).click()
  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible()

  // Cambiar el nick.
  const newNick = `nuevo${u.suffix}`
  await page.getByLabel("Nick").fill(newNick)
  await page.getByRole("button", { name: "Guardar" }).click()

  await expect(page.getByTestId("user-nickname")).toHaveText(newNick)
})
