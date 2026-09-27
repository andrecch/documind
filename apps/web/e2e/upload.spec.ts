import { test, expect } from "@playwright/test";

test("1×1 PNG → /es/review muestra la hoja rellenada y los datos extraídos", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByRole("heading", { name: "DOCUMIND" })).toBeVisible();
  // Sentinel de hidratación: el toggle solo se monta cuando React está activo
  await expect(page.getByRole("button", { name: "Cambiar a tema oscuro" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/sample.png");
  await expect(page).toHaveURL(/\/es\/review$/, { timeout: 15_000 });
  await expect(page.getByText("HOJA RELLENADA POR LA IA DE VISIÓN")).toBeVisible();
  await expect(page.getByText("DATOS EXTRAÍDOS · JSON")).toBeVisible();
  const copyBtn = page.getByRole("button", { name: "COPIAR" });
  await copyBtn.click();
  await expect(page.getByRole("button", { name: "¡COPIADO!" })).toBeVisible();
});

test("rechaza un tipo no admitido", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByRole("button", { name: "Cambiar a tema oscuro" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "doc.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK"),
  });
  await expect(page.getByText("Formato no admitido")).toBeVisible();
  await expect(page).toHaveURL(/\/es$/);
});

test("el JSON completo se expande y vuelve al formulario", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByRole("button", { name: "Cambiar a tema oscuro" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/sample.png");
  await expect(page).toHaveURL(/\/es\/review$/);
  await page.getByRole("button", { name: /VER JSON COMPLETO/ }).click();
  await expect(page.getByText('"tipo_documento": "factura"')).toBeVisible();
  await page.getByRole("button", { name: /VER FORMULARIO/ }).click();
  await expect(page.getByText("HOJA RELLENADA POR LA IA DE VISIÓN")).toBeVisible();
});
