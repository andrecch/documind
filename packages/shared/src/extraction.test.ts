import { describe, expect, it } from "vitest";
import { extractionResultSchema, validateExtraction, SAMPLE_EXTRACTION } from "./extraction";

describe("extractionResultSchema v2 — campos raíz por doc_type", () => {
  it("acepta los campos de contrato", () => {
    const parsed = extractionResultSchema.parse({
      doc_type: "contrato",
      objeto: "Arrendamiento de local",
      partes: "Arrendador y arrendatario",
      fecha_inicio: "2026-01-01",
      fecha_fin: "2026-12-31",
      valor: 36000000,
      confianza: 0.9,
    });
    expect(parsed.objeto).toBe("Arrendamiento de local");
    expect(parsed.valor).toBe(36000000);
  });

  it("acepta los campos de propuesta", () => {
    const parsed = extractionResultSchema.parse({
      doc_type: "propuesta",
      alcance: "Diseño de prototipos",
      entidad: "Alcaldía de Chía",
      vigencia: "2026-11-30",
      valor: 8500000,
      confianza: 0.8,
    });
    expect(parsed.entidad).toBe("Alcaldía de Chía");
  });

  it("acepta los campos de documentación", () => {
    const parsed = extractionResultSchema.parse({
      doc_type: "documentacion",
      entidades: "MinHacienda, DIAN",
      referencia: "OFI-2026-1122",
      asunto: "Solicitud de copia",
      contenido: "Radique el concepto 20261000001234.",
      fecha_emision: "2026-08-03",
      confianza: 0.85,
    });
    expect(parsed.referencia).toBe("OFI-2026-1122");
  });

  it("rechaza confianza fuera de rango", () => {
    expect(() => extractionResultSchema.parse({ doc_type: "factura", confianza: 1.5 })).toThrow();
  });

  it("rechaza doc_type desconocido", () => {
    expect(() => extractionResultSchema.parse({ doc_type: "recibo2", confianza: 0.5 })).toThrow();
  });
});

describe("validateExtraction", () => {
  it("conserva los campos raíz nuevos", () => {
    const result = validateExtraction({
      doc_type: "contrato",
      objeto: "Prestación de servicios",
      valor: 1000,
      confianza: 0.7,
    });
    expect(result.objeto).toBe("Prestación de servicios");
    expect(result.valor).toBe(1000);
  });

  it("descarta claves de fila fuera del schema del doc_type", () => {
    const result = validateExtraction({
      ...SAMPLE_EXTRACTION,
      items: [
        { descripcion: "A", cantidad: 1, valor_unitario: 100, valor_total: 100, invento: "x" },
      ],
    });
    expect(result.items?.[0]).toEqual({
      descripcion: "A",
      cantidad: 1,
      valor_unitario: 100,
      valor_total: 100,
    });
  });

  it("elimina filas vacías y deja items undefined si no queda ninguna", () => {
    const result = validateExtraction({
      doc_type: "contrato",
      confianza: 0.5,
      items: [{ basura: 1 }, {}],
    });
    expect(result.items).toBeUndefined();
  });

  it("normaliza null a ausencia dentro de las filas", () => {
    const result = validateExtraction({
      ...SAMPLE_EXTRACTION,
      items: [{ descripcion: "B", cantidad: null, valor_unitario: 50, valor_total: 50 }],
    });
    expect(result.items?.[0]).toEqual({ descripcion: "B", valor_unitario: 50, valor_total: 50 });
  });

  it("mantiene SAMPLE_EXTRACTION intacta", () => {
    const result = validateExtraction(SAMPLE_EXTRACTION);
    expect(result).toEqual(SAMPLE_EXTRACTION);
  });
});
