import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// Requiere: docker compose up -d + API en :4000 con DOCUMIND_FAKE_PROVIDERS=1.
// El webServer de playwright levanta la web (build prod en :3101, reuseExistingServer).

const API = "http://localhost:4000/api/v1";

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

async function readApi<T>(res: Response): Promise<T> {
  expect(res.status).toBe(200);
  return (await res.json()) as T;
}

async function fetchExtraction(documentId: string) {
  return readApi<{
    status: string;
    extraction: { numero?: string; items?: { descripcion?: string }[] };
    fieldAudit: Record<string, unknown> | null;
  }>(await fetch(`${API}/documents/${documentId}/extraction`));
}

test("M3 parte A: edición de archivada persiste con auditoría y los chunks se regeneran", async ({
  page,
}: {
  page: Page;
}) => {
  const name = `m3-${randomUUID()}.png`;
  await uploadAndConfirm(page, name);

  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page.getByText("ARCHIVO — ÚLTIMOS DOCUMENTOS")).toBeVisible();
  await page.getByRole("button", { name: new RegExp(name.replace(/[-.]/g, "[$&]")) }).click();
  await expect(page).toHaveURL(/\/es\/review$/, { timeout: 10_000 });

  const numeroInput = page.getByLabel("NÚMERO / REFERENCIA");
  await expect(numeroInput).toBeDisabled();
  await page.getByRole("button", { name: "EDITAR ARCHIVADA" }).click();
  await expect(page.getByText("LOS VECTORES SE REGENERARÁN AL GUARDAR")).toBeVisible();
  await expect(numeroInput).toBeEnabled();
  await numeroInput.fill("FAC-M3-EDIT");
  await page.getByLabel(/FILA 1 · DESCRIPCIÓN/).fill("Revisión M3");
  await expect(page.getByText("GUARDADO", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/AUDITORÍA DEL GUARDADO — \d+ CAMPOS/)).toBeVisible();

  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page.getByText("ARCHIVO — ÚLTIMOS DOCUMENTOS")).toBeVisible();
  await page.getByRole("button", { name: new RegExp(name.replace(/[-.]/g, "[$&]")) }).click();
  await expect(page.getByLabel("NÚMERO / REFERENCIA")).toHaveValue("FAC-M3-EDIT", {
    timeout: 15_000,
  });

  const list = await readApi<{ items: { id: string; filename: string }[] }>(
    await fetch(`${API}/documents?q=${encodeURIComponent(name)}`),
  );
  expect(list.items).toHaveLength(1);
  const id = list.items[0].id;

  const detail = await fetchExtraction(id);
  expect(detail.status).toBe("confirmed");
  expect(detail.extraction.numero).toBe("FAC-M3-EDIT");
  expect(detail.extraction.items?.[0]?.descripcion).toBe("Revisión M3");
  const audit = Object.keys(detail.fieldAudit ?? {});
  expect(audit).toContain("numero");
  expect(audit).toContain("items.0.descripcion");

  const hits = await readApi<{ items: { documentId: string; content: string }[] }>(
    await fetch(`${API}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Revisión", limit: 20 }),
    }),
  );
  expect(
    hits.items.some((hit) => hit.documentId === id && hit.content.includes("Revisión M3")),
  ).toBe(true);
});
