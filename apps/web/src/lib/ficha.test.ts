import { describe, expect, it } from "vitest";
import { SAMPLE_EXTRACTION } from "@documind/shared";
import {
  fromExtraction,
  itemsTotalsMismatch,
  parseNumeric,
  toExtraction,
  type EditableFicha,
} from "./ficha";

describe("parseNumeric", () => {
  it("acepta formatos plain y es", () => {
    expect(parseNumeric("890000")).toBe(890000);
    expect(parseNumeric("1234.56")).toBe(1234.56);
    expect(parseNumeric("1.234,56")).toBe(1234.56);
    expect(parseNumeric(" 12 ")).toBe(12);
  });

  it("devuelve undefined para vacío o basura", () => {
    expect(parseNumeric("")).toBeUndefined();
    expect(parseNumeric("   ")).toBeUndefined();
    expect(parseNumeric("abc")).toBeUndefined();
  });
});

describe("fromExtraction / toExtraction", () => {
  it("round-trip conserva los datos de la muestra", () => {
    const editable = fromExtraction(SAMPLE_EXTRACTION);
    expect(editable.fields["emisor.nombre"]).toBe("Suministros Andinos S.A.");
    expect(editable.fields["items_total"]).toBe("2450000");
    const back = toExtraction(editable, SAMPLE_EXTRACTION.confianza);
    expect(back).toEqual(SAMPLE_EXTRACTION);
  });

  it("descarta campos vacíos y filas sin datos", () => {
    const editable = fromExtraction(SAMPLE_EXTRACTION);
    editable.fields["numero"] = "";
    editable.items.push({ descripcion: "", cantidad: "", valor_unitario: "", valor_total: "" });
    const result = toExtraction(editable, 0.9);
    expect(result.numero).toBeUndefined();
    expect(result.items).toHaveLength(2);
  });

  it("al cambiar a contrato limpia las filas a nivel de cliente", () => {
    const editable: EditableFicha = {
      doc_type: "contrato",
      fields: { objeto: "Arrendamiento", partes: "A y B" },
      items: [{ descripcion: "x", cantidad: "1" }],
    };
    const result = toExtraction(editable, 0.5);
    expect(result.objeto).toBe("Arrendamiento");
    expect(result.items).toBeUndefined();
  });
});

describe("itemsTotalsMismatch", () => {
  it("detecta discrepancia entre la suma de filas y items_total", () => {
    const editable = fromExtraction(SAMPLE_EXTRACTION);
    editable.items[0]!.valor_total = "999";
    expect(itemsTotalsMismatch(editable)).toEqual({ expected: 1560999, declared: 2450000 });
  });

  it("no alerta cuando cuadra", () => {
    expect(itemsTotalsMismatch(fromExtraction(SAMPLE_EXTRACTION))).toBeNull();
  });

  it("no alerta sin items_total o sin filas", () => {
    const editable = fromExtraction(SAMPLE_EXTRACTION);
    editable.fields["items_total"] = "";
    expect(itemsTotalsMismatch(editable)).toBeNull();
    const empty: EditableFicha = { doc_type: "factura", fields: { items_total: "5" }, items: [] };
    expect(itemsTotalsMismatch(empty)).toBeNull();
  });
});
