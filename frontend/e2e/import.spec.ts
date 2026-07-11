import { expect, test } from "@playwright/test"

// Flujo real de importación: registro → /importar → subir CSV → previsualizar →
// confirmar → ver los movimientos importados en /movimientos.

const CSV = `IBAN;Saldo disponible;Periodo
ES3421003540962100636404;11.766,93;01/06/2026 - 11/07/2026
Concepto;Fecha;Importe;Saldo disponible
MERCADONA JULIAN;24/06/2026;-13,18EUR;11.754,57EUR
BAR FETICHE;10/07/2026;-6,40EUR;11.766,93EUR
PREST. DESEMPLEO;10/07/2026;758,61EUR;11.773,33EUR
`

function uniqueUser() {
  const s = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  return { nickname: `imp${s}`, email: `imp${s}@mail.com`, password: "Str0ng!Pass" }
}

test("importar un CSV de extracto", async ({ page }) => {
  const u = uniqueUser()
  await page.goto("/register")
  await page.getByLabel("Nick").fill(u.nickname)
  await page.getByLabel("Email").fill(u.email)
  await page.getByLabel("Contraseña", { exact: true }).fill(u.password)
  await page.getByLabel("Repetir contraseña").fill(u.password)
  await page.getByRole("button", { name: "Registrarme" }).click()

  await page.getByRole("link", { name: "Ver movimientos" }).click()
  await page.getByRole("link", { name: "Importar CSV" }).click()
  await expect(page.getByRole("heading", { name: "Importar movimientos" })).toBeVisible()

  await page.getByLabel("Archivo CSV").setInputFiles({
    name: "extracto.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV, "utf-8"),
  })
  await page.getByRole("button", { name: "Previsualizar" }).click()

  // Se clasifica Mercadona por regla.
  await expect(page.getByText("MERCADONA JULIAN")).toBeVisible()
  await expect(page.getByTestId("import-summary")).toContainText("3")

  await page.getByRole("button", { name: /Confirmar importación/ }).click()

  // Vuelve a movimientos y aparecen los importados.
  await expect(page.getByRole("heading", { name: "Movimientos" })).toBeVisible()
  await expect(page.getByText("MERCADONA JULIAN")).toBeVisible()
})
