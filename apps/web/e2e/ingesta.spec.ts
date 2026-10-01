import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// Requiere: docker compose up -d + API en :4000 con DOCUMIND_FAKE_PROVIDERS=1.
// El webServer de playwright levanta la web (build prod en :3101).

function pngFixture(name: string) {
  return { name, mimeType: "image/png", buffer: readFileSync("e2e/fixtures/sample.png") };
}

async function uploadAndExtract(page: Page, name: string): Promise<void> {
  await page.goto("/es");
  await expect(page.getByRole("button", { name: "Cambiar a tema oscuro" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(pngFixture(name));
  await expect(page).toHaveURL(/\/es\/review$/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "EXTRAER DATOS" })).toBeVisible();
  await page.getByRole("button", { name: "EXTRAER DATOS" }).click();
  await expect(page.getByText("FICHA EDITABLE — REVISE Y CORRIJA")).toBeVisible({
    timeout: 30_000,
  });
}

test("rechaza tipos no admitidos sin salir de la home", async ({ page }) => {
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

test("sube un PNG, extrae con provider fake y muestra la ficha con ítems", async ({ page }) => {
  await uploadAndExtract(page, `ficha-${randomUUID()}.png`);
  await expect(page.getByLabel("NÚMERO / REFERENCIA")).toHaveValue("FAC-2026-0847");
  await expect(page.getByLabel(/FILA 1 · DESCRIPCIÓN/)).toHaveValue("Instalación eléctrica");
  await expect(page.getByText("BORRADOR")).toBeVisible();
  await expect(page.getByText("ÍTEMS DE LA FACTURA")).toBeVisible();
});

test("editar dispara el PATCH con debounce y persiste al reabrir desde el historial", async ({
  page,
}) => {
  const name = `persist-${randomUUID()}.png`;
  await uploadAndExtract(page, name);
  await page.getByLabel("NÚMERO / REFERENCIA").fill("FAC-E2E-PERSIST");
  await expect(page.getByText("GUARDADO", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page.getByText("ARCHIVO — ÚLTIMOS DOCUMENTOS")).toBeVisible();
  await page.getByRole("button", { name: new RegExp(name.replace(/[-.]/g, "[$&]")) }).click();
  await expect(page).toHaveURL(/\/es\/review$/);
  await expect(page.getByLabel("NÚMERO / REFERENCIA")).toHaveValue("FAC-E2E-PERSIST", {
    timeout: 15_000,
  });
});

test("cambiar el tipo re-renderiza la ficha según su schema", async ({ page }) => {
  await uploadAndExtract(page, `tipo-${randomUUID()}.png`);
  await page.getByLabel("TIPO DE DOCUMENTO").selectOption("contrato");
  await expect(page.getByText("OBJETO DEL CONTRATO")).toBeVisible();
  await expect(page.getByText("ÍTEMS DE LA FACTURA")).toBeHidden();
  await expect(page.getByLabel("VALOR")).toBeVisible();
});

test("la alerta de totales aparece cuando la suma de filas no cuadra", async ({ page }) => {
  await uploadAndExtract(page, `totales-${randomUUID()}.png`);
  await page.getByLabel(/FILA 1 · VALOR TOTAL/).fill("10");
  await expect(page.getByText(/La suma de las filas es/)).toBeVisible({ timeout: 5_000 });
});
