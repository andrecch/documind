import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// Requiere: docker compose up -d + API en :4000 con DOCUMIND_FAKE_PROVIDERS=1
// y DOCUMIND_MASTER_KEY exportada antes de arrancar la API (receta en docs/plans/2026-10-03-m2-recovery.md Task 8).
// El webServer de playwright levanta la web (build prod en :3101) con API_PROXY_URL por defecto → :4000.

function pngFixture(name: string) {
  return { name, mimeType: "image/png", buffer: readFileSync("e2e/fixtures/sample.png") };
}

async function uploadAndConfirm(page: Page, name: string): Promise<void> {
  await page.goto("/es");
  await expect(page.getByRole("button", { name: "Cambiar a tema oscuro" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(pngFixture(name));
  await expect(page).toHaveURL(/\/es\/review$/, { timeout: 20_000 });
  await page.getByRole("button", { name: "EXTRAER DATOS" }).click();
  await expect(page.getByText("FICHA EDITABLE — REVISE Y CORRIJA")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "CONFIRMAR Y ARCHIVAR" }).click();
  await expect(page.getByText("ARCHIVADA", { exact: true })).toBeVisible({ timeout: 15_000 });
}

test("flujo M2: búsqueda con resaltado, chat con cita clicable y ajustes con hint", async ({
  page,
}) => {
  await uploadAndConfirm(page, `m2-${randomUUID()}.png`);

  await page.goto("/es/search");
  await expect(page.getByText("CONSULTA AL ARCHIVO")).toBeVisible();
  await page.getByPlaceholder(/¿Qué busca en sus documentos/).fill("instalación");
  await page.getByRole("button", { name: "BUSCAR" }).click();
  await expect(page.locator("mark").first()).toBeVisible({ timeout: 10_000 });

  await page.locator("ul.divide-y li").first().click();
  await expect(page).toHaveURL(/\/es\/review$/, { timeout: 10_000 });

  await page.goto("/es/chat");
  await expect(page.getByText("PREGÚNTELE A SU ARCHIVO")).toBeVisible();
  await page.getByPlaceholder("Pregunte por sus documentos…").fill("¿Cuánto costó la instalación?");
  await page.getByLabel("Enviar pregunta").click();
  await expect(page.getByText(/Según tus documentos/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /ítem 1/ }).first()).toBeVisible({
    timeout: 10_000,
  });
  await page
    .getByRole("button", { name: /ítem 1/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/es\/review$/, { timeout: 10_000 });
});

test("ajustes: guardar la clave muestra el hint enmascarado", async ({ page }) => {
  await page.goto("/es/settings");
  await expect(page.getByText("AJUSTES DEL TALONARIO")).toBeVisible();

  const keyInput = page.locator('input[type="password"]');
  await keyInput.fill("sk-or-v1-e2e-ledger-test-key-0123456789");
  await page.getByRole("button", { name: "GUARDAR CLAVE" }).click();
  await expect(page.getByText(/guardada: ••••6789/)).toBeVisible({ timeout: 10_000 });
  await expect(keyInput).toHaveValue("");
});
