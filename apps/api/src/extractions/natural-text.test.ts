import { describe, expect, it } from "vitest";
import { SAMPLE_EXTRACTION, type ExtractionResult } from "@documind/shared";
import { naturalTextForDocument, naturalTextsForExtraction } from "./natural-text";

describe("naturalTextForDocument", () => {
  it("factura: número, emisor, receptor, fechas y totales", () => {
    const text = naturalTextForDocument(SAMPLE_EXTRACTION);
    expect(text).toContain("Factura FAC-2026-0847");
    expect(text).toContain("emitida por Suministros Andinos S.A. (901.245.678-1)");
    expect(text).toContain("a favor de Constructora Delta Ltda.");
    expect(text).toContain("fecha 2026-09-12");
    expect(text).toContain("total COP 2915500");
  });

  it("contrato: objeto, partes, vigencia y valor", () => {
    const contrato: ExtractionResult = {
      doc_type: "contrato",
      objeto: "Arrendamiento de local comercial",
      partes: "Suministros Andinos S.A. y Constructora Delta Ltda.",
      fecha_inicio: "2026-01-01",
      fecha_fin: "2026-12-31",
      valor: 36000000,
      confianza: 0.9,
    };
    const text = naturalTextForDocument(contrato);
    expect(text).toContain("objeto: Arrendamiento de local comercial");
    expect(text).toContain("vigencia 2026-01-01 a 2026-12-31");
    expect(text).toContain("valor 36000000");
  });

  it("documentacion: referencia, asunto y contenido", () => {
    const doc: ExtractionResult = {
      doc_type: "documentacion",
      referencia: "OFI-2026-1122",
      entidades: "MinHacienda, DIAN",
      asunto: "Solicitud de copia del concepto 20261000001234",
      contenido: "Se radica la solicitud con anexos.",
      confianza: 0.8,
    };
    const text = naturalTextForDocument(doc);
    expect(text).toContain("Documentación OFI-2026-1122");
    expect(text).toContain("asunto: Solicitud de copia");
    expect(text).toContain("Se radica la solicitud con anexos.");
  });

  it("prescinde de los campos ausentes sin dejar separadores sueltos", () => {
    const minimo: ExtractionResult = { doc_type: "recibo", confianza: 0.5 };
    expect(naturalTextForDocument(minimo)).toBe("Recibo sin número");
  });
});

describe("naturalTextsForExtraction", () => {
  it("padre + un hijo por fila con etiquetas de columna", () => {
    const texts = naturalTextsForExtraction(SAMPLE_EXTRACTION);
    expect(texts.document).toContain("Factura FAC-2026-0847");
    expect(texts.items).toHaveLength(2);
    expect(texts.items[0]).toEqual({
      itemIndex: 0,
      content: expect.stringContaining("Ítem 1 de factura"),
    });
    expect(texts.items[0]!.content).toContain("DESCRIPCIÓN: Instalación eléctrica");
    expect(texts.items[0]!.content).toContain("VALOR TOTAL: 890000");
    expect(texts.items[1]!.content).toContain("CANT.: 12");
  });

  it("tipos sin tabla solo generan el documento padre", () => {
    const contrato: ExtractionResult = {
      doc_type: "contrato",
      objeto: "Prestación de servicios",
      confianza: 0.7,
    };
    const texts = naturalTextsForExtraction(contrato);
    expect(texts.items).toHaveLength(0);
    expect(texts.document).toContain("objeto: Prestación de servicios");
  });
});
