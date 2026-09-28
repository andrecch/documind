import { describe, expect, it } from "vitest";
import { SAMPLE_EXTRACTION, validateExtraction } from "./extraction";
import { DOC_TYPE_TABLE_SCHEMA, emptyRowFor, getRowKeysForDocType } from "./table-schema";

describe("DOC_TYPE_TABLE_SCHEMA", () => {
  it("factura tiene tabla de items con 4 columnas", () => {
    const tables = DOC_TYPE_TABLE_SCHEMA.factura;
    expect(tables).toHaveLength(1);
    expect(tables[0].columns.map((c) => c.key)).toEqual([
      "descripcion",
      "cantidad",
      "valor_unitario",
      "valor_total",
    ]);
  });

  it("contrato y documentación no tienen tablas", () => {
    expect(DOC_TYPE_TABLE_SCHEMA.contrato).toEqual([]);
    expect(DOC_TYPE_TABLE_SCHEMA.documentacion).toEqual([]);
  });

  it("emptyRowFor inicializa por tipo de columna", () => {
    const row = emptyRowFor(DOC_TYPE_TABLE_SCHEMA.factura[0]);
    expect(row).toEqual({ descripcion: "", cantidad: 0, valor_unitario: 0, valor_total: 0 });
  });
});

describe("validateExtraction", () => {
  it("normaliza el sample", () => {
    const parsed = validateExtraction(SAMPLE_EXTRACTION);
    expect(parsed.doc_type).toBe("factura");
    expect(parsed.items).toHaveLength(2);
  });

  it("elimina claves que no pertenecen al schema del doc_type", () => {
    const parsed = validateExtraction({
      doc_type: "factura",
      confianza: 0.9,
      items: [{ descripcion: "X", concepto_ajeno: "ruido", valor_total: 100 }],
    });
    expect(parsed.items?.[0]).toEqual({ descripcion: "X", valor_total: 100 });
  });

  it("elimina filas vacías y null", () => {
    const parsed = validateExtraction({
      doc_type: "recibo",
      confianza: 0.9,
      items: [
        { concepto: null, valor: null },
        { concepto: "pago", valor: 5000 },
      ],
    });
    expect(parsed.items).toEqual([{ concepto: "pago", valor: 5000 }]);
  });

  it("deja items undefined si no quedan filas", () => {
    const parsed = validateExtraction({
      doc_type: "contrato",
      confianza: 0.9,
      items: [{ ruido: 1 }],
    });
    expect(parsed.items).toBeUndefined();
  });

  it("rechaza doc_type desconocido", () => {
    expect(() => validateExtraction({ doc_type: "otro", confianza: 0.9 })).toThrow();
  });

  it("rechaza confianza fuera de rango", () => {
    expect(() => validateExtraction({ doc_type: "factura", confianza: 2 })).toThrow();
  });

  it("getRowKeysForDocType lista las claves permitidas", () => {
    expect(getRowKeysForDocType("propuesta")).toEqual(["concepto", "valor"]);
  });
});
