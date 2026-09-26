import { test, expect } from "@playwright/test";

test("1×1 PNG → /es/review muestra el JSON de muestra", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Sentinel de hidratación: el toggle solo se monta cuando React está activo
  await expect(page.getByRole("button", { name: "Cambiar a tema claro" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/sample.png");
  await expect(page).toHaveURL(/\/es\/review$/);
  await expect(page.getByText('"tipo_documento"')).toBeVisible();
  const copyBtn = page.getByRole("button", { name: "Copiar JSON" });
  await copyBtn.click();
  await expect(page.getByRole("button", { name: "¡Copiado!" })).toBeVisible();
});

test("rechaza un tipo no admitido", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByRole("button", { name: "Cambiar a tema claro" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "doc.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK"),
  });
  await expect(page.getByText("Formato no admitido")).toBeVisible();
  await expect(page).toHaveURL(/\/es$/);
});
