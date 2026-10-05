import { describe, expect, it } from "vitest";
import type { ExtractionResult, FieldAudit } from "@documind/shared";
import { fichaJson, itemsCsv } from "./export";

const ITEMS: Record<string, number | string>[] = [
  { descripcion: "Instalación eléctrica", cantidad: 3, valor_unitario: 9000, valor_total: 27000 },
  { descripcion: "Mano de obra; refuerzos", cantidad: 1, valor_unitario: 50, valor_total: 50.5 },
];

const FACTURA = {
  doc_type: "factura",
  numero: "FAC-2026-0847",
  confianza: 96,
  items: ITEMS,
} as unknown as ExtractionResult;

const AUDIT = {
  numero: { llm: "VIEJO", human: "FAC-2026-0847" },
} as unknown as FieldAudit;

describe("fichaJson", () => {
  it("serializa document_id, confirmed_data, field_audit y exported_at", () => {
    const out = JSON.parse(
      fichaJson({
        documentId: "46f4a3bd-3e5d-4a44-b4a1-000000000001",
        filename: "muestra.png",
        docType: "factura",
        extraction: FACTURA,
        fieldAudit: AUDIT,
        tokens: { prompt: 120, completion: 40 },
      }),
    ) as {
      document_id: string;
      doc_type: string;
      confirmed_data: ExtractionResult;
      field_audit: FieldAudit;
      tokens: { prompt: number };
      exported_at: string;
    };
    expect(out.document_id).toBe("46f4a3bd-3e5d-4a44-b4a1-000000000001");
    expect(out.doc_type).toBe("factura");
    expect(out.confirmed_data).toEqual(FACTURA);
    expect(out.field_audit).toEqual(AUDIT);
    expect(out.tokens.prompt).toBe(120);
    expect(new Date(out.exported_at).toISOString()).toBe(out.exported_at);
  });

  it("permite field_audit null", () => {
    const out = JSON.parse(
      fichaJson({
        documentId: "46f4a3bd-3e5d-4a44-b4a1-000000000002",
        filename: "otra.png",
        docType: "factura",
        extraction: FACTURA,
        fieldAudit: null,
        tokens: { prompt: 0, completion: 0 },
      }),
    ) as { field_audit: null };
    expect(out.field_audit).toBeNull();
  });
});

describe("itemsCsv", () => {
  it("factura con 2 filas produce cabecera + 2 líneas con BOM y escape", () => {
    const csv = itemsCsv("factura", ITEMS);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("DESCRIPCIÓN;CANT.;VALOR UNIT.;VALOR TOTAL");
    expect(lines[1]).toBe("Instalación eléctrica;3;9000;27000");
    expect(lines[2]).toBe('"Mano de obra; refuerzos";1;50;50.5');
  });

  it("sin items devuelve cadena vacía", () => {
    expect(itemsCsv("factura", [])).toBe("");
    expect(itemsCsv("contrato", [])).toBe("");
  });
});
