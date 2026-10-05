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

test("M3 parte B: export de ficha JSON y de ítems CSV en archivado read-only", async ({
  page,
}: {
  page: Page;
}) => {
  await purgeByPrefix("m3x-");
  const name = `m3x-${randomUUID()}.png`;
  await uploadAndConfirm(page, name);

  await expect(page.getByRole("button", { name: "EXPORTAR" })).toBeVisible();
  const base = name.replace(/\.[^.]+$/, "");

  await page.getByRole("button", { name: "EXPORTAR" }).click();
  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "FICHA (.JSON)" }).click(),
  ]);
  expect(jsonDownload.suggestedFilename()).toBe(`${base}.json`);
  const jsonRaw = readFileSync(await jsonDownload.path(), "utf8");
  const json = JSON.parse(jsonRaw) as {
    doc_type: string;
    filename: string;
    confirmed_data: { numero: string; items: { descripcion: string }[] };
    field_audit: Record<string, unknown> | null;
    exported_at: string;
  };
  expect(json.doc_type).toBe("factura");
  expect(json.filename).toBe(name);
  expect(json.confirmed_data.numero).toBe("FAC-2026-0847");
  expect(json.confirmed_data.items).toHaveLength(2);
  expect(json.field_audit).toBeNull();
  expect(new Date(json.exported_at).toISOString()).toBe(json.exported_at);

  await page.getByRole("button", { name: "EXPORTAR" }).click();
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "ÍTEMS (.CSV)" }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toBe(`${base} - items.csv`);
  const csv = readFileSync(await csvDownload.path(), "utf8");
  expect(csv.startsWith("\uFEFF")).toBe(true);
  const lines = csv.replace("\uFEFF", "").split("\r\n");
  expect(lines).toHaveLength(3);
  expect(lines[0]).toBe("DESCRIPCIÓN;CANT.;VALOR UNIT.;VALOR TOTAL");
  expect(lines[1]).toContain("Instalación eléctrica");

  await deleteApi(await idFor(name));
  const gone = await readApi<{ items: unknown[] }>(
    await fetch(`${API}/documents?q=${encodeURIComponent(name)}`),
  );
  expect(gone.items).toHaveLength(0);
});

async function idFor(name: string): Promise<string> {
  const found = await readApi<{ items: { id: string }[] }>(
    await fetch(`${API}/documents?q=${encodeURIComponent(name)}`),
  );
  const id = found.items[0]?.id;
  if (!id) throw new Error(`document ${name} not found`);
  return id;
}

async function readApi<T>(res: Response): Promise<T> {
  expect(res.status).toBe(200);
  return (await res.json()) as T;
}

async function deleteApi(id: string): Promise<void> {
  const res = await fetch(`${API}/documents/${id}`, { method: "DELETE" });
  expect([200, 404]).toContain(res.status);
}

async function purgeByPrefix(prefix: string): Promise<void> {
  const listing = await readApi<{ items: { id: string }[] }>(
    await fetch(`${API}/documents?q=${encodeURIComponent(prefix)}&limit=100`),
  );
  for (const doc of listing.items) {
    await deleteApi(doc.id);
  }
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
  await purgeByPrefix("m3-");
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

  await deleteApi(id);
  const gone = await readApi<{ items: unknown[] }>(
    await fetch(`${API}/documents?q=${encodeURIComponent(name)}`),
  );
  expect(gone.items).toHaveLength(0);
});

test("M3 cierre: historial con filtros, VER MÁS, edición, export y eliminación", async ({
  page,
}: {
  page: Page;
}) => {
  test.setTimeout(180_000);
  const stamp = randomUUID().slice(0, 8);
  const name = `m3full-${stamp}.png`;
  const buffer = readFileSync("e2e/fixtures/sample.png");

  for (let i = 0; i < 21; i += 1) {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: "image/png" }),
      `m3full-${stamp}-${i}.png`,
    );
    const res = await fetch(`${API}/documents`, { method: "POST", body: form });
    expect(res.status).toBe(201);
  }

  await uploadAndConfirm(page, name);
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page.getByText("ARCHIVO — ÚLTIMOS DOCUMENTOS")).toBeVisible();

  const qInput = page.getByPlaceholder("buscar por nombre de archivo");
  await qInput.fill(`m3full-${stamp}`);
  await page.getByRole("button", { name: "BUSCAR", exact: true }).click();
  await expect(page.getByText("22 documento(s)", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  const more = page.getByRole("button", { name: "VER MÁS" });
  await expect(more).toBeVisible();
  await expect(page.locator("ul.divide-y li")).toHaveCount(20);
  await more.click();
  await expect(page.locator("ul.divide-y li")).toHaveCount(22, { timeout: 10_000 });

  const typeSelect = page.getByRole("combobox").first();
  const statusSelect = page.getByRole("combobox").nth(1);

  await typeSelect.selectOption("factura");
  await expect(page.locator("ul.divide-y li")).toHaveCount(1, { timeout: 10_000 });

  await statusSelect.selectOption("archivado");
  await expect(page.locator("ul.divide-y li")).toHaveCount(1, { timeout: 10_000 });

  await typeSelect.selectOption("");
  await expect(page.locator("ul.divide-y li")).toHaveCount(1, { timeout: 10_000 });

  await statusSelect.selectOption("pending");
  await expect(page.locator("ul.divide-y li")).toHaveCount(20, { timeout: 10_000 });
  await expect(page.getByText("21 documento(s)", { exact: true })).toBeVisible();

  const fromInput = page.locator('input[type="date"]').first();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await fromInput.fill(tomorrow);
  await expect(page.locator("ul.divide-y li")).toHaveCount(0, { timeout: 10_000 });
  await fromInput.fill("");
  await expect(page.locator("ul.divide-y li")).toHaveCount(20, { timeout: 10_000 });

  await statusSelect.selectOption("");
  await expect(page.locator("ul.divide-y li")).toHaveCount(20, { timeout: 10_000 });
  await expect(page.getByText("22 documento(s)", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: new RegExp(name.replace(/[-.]/g, "[$&]")) }).click();
  await expect(page).toHaveURL(/\/es\/review$/, { timeout: 10_000 });
  await page.getByRole("button", { name: "EDITAR ARCHIVADA" }).click();
  await page.getByLabel("NÚMERO / REFERENCIA").fill("FAC-M3-CLOSE");
  await expect(page.getByText("GUARDADO", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "EXPORTAR" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "FICHA (.JSON)" }).click(),
  ]);
  const json = JSON.parse(readFileSync(await download.path(), "utf8")) as {
    confirmed_data: { numero: string };
  };
  expect(json.confirmed_data.numero).toBe("FAC-M3-CLOSE");

  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page.getByText("ARCHIVO — ÚLTIMOS DOCUMENTOS")).toBeVisible();
  const qAfterReview = page.getByPlaceholder("buscar por nombre de archivo");
  await qAfterReview.fill(`m3full-${stamp}`);
  await page.getByRole("button", { name: "BUSCAR", exact: true }).click();
  await expect(page.getByText("22 documento(s)", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  const targetCard = page
    .getByRole("button", { name: new RegExp(name.replace(/[-.]/g, "[$&]")) })
    .first();
  const targetItem = page.locator("ul.divide-y li").filter({ has: targetCard });
  await targetItem.getByRole("button").last().click();
  await expect(page.getByText("¿ELIMINAR ARCHIVADA?")).toBeVisible();
  await page.getByRole("button", { name: "SÍ", exact: true }).click();
  await expect(page.getByText("ELIMINADA", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(targetItem).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText("21 documento(s)", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  const removed = await readApi<{ items: { id: string }[] }>(
    await fetch(`${API}/documents?q=${encodeURIComponent(name)}`),
  );
  expect(removed.items).toHaveLength(0);

  const listing = await readApi<{ items: { id: string }[] }>(
    await fetch(`${API}/documents?q=${encodeURIComponent(`m3full-${stamp}`)}&limit=100`),
  );
  expect(listing.items).toHaveLength(21);
  for (const doc of listing.items) {
    await deleteApi(doc.id);
  }
  const cleanup = await readApi<{ total: number }>(
    await fetch(`${API}/documents?q=${encodeURIComponent(`m3full-${stamp}`)}&limit=100`),
  );
  expect(cleanup.total).toBe(0);
});
