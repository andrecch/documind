import { describe, expect, it } from "vitest";
import { diffFields } from "./audit";
import type { ExtractionRow } from "./extraction";

describe("diffFields", () => {
  it("detecta cambio en campo raíz", () => {
    const audit = diffFields({ numero: "FAC-1" }, { numero: "FAC-2" });
    expect(audit).toEqual({ numero: { llm: "FAC-1", human: "FAC-2" } });
  });

  it("recorre objetos anidados (emisor)", () => {
    const audit = diffFields(
      { emisor: { nombre: "A", identificacion: "1" } },
      { emisor: { nombre: "B", identificacion: "1" } },
    );
    expect(audit).toEqual({
      "emisor.nombre": { llm: "A", human: "B" },
    });
  });

  it("detecta cambio en celda de items con path plano", () => {
    const row: ExtractionRow = { descripcion: "X", cantidad: 1, valor_total: 100 };
    const fixed: ExtractionRow = { descripcion: "X", cantidad: 1, valor_total: 150 };
    const audit = diffFields({ items: [row] }, { items: [fixed] });
    expect(audit).toEqual({
      "items.0.valor_total": { llm: 100, human: 150 },
    });
  });

  it("registra ítem añadido", () => {
    const audit = diffFields({ items: [] }, { items: [{ concepto: "nuevo", valor: 10 }] });
    expect(audit).toEqual({
      "items.0": { llm: null, human: { concepto: "nuevo", valor: 10 } },
    });
  });

  it("registra ítem borrado", () => {
    const audit = diffFields({ items: [{ concepto: "viejo", valor: 10 }] }, { items: [] });
    expect(audit).toEqual({
      "items.0": { llm: { concepto: "viejo", valor: 10 }, human: null },
    });
  });

  it("no reporta cambios cuando llm y human coinciden", () => {
    const audit = diffFields(
      { numero: "A", total: 100, items: [{ concepto: "x", valor: 1 }] },
      { numero: "A", total: 100, items: [{ concepto: "x", valor: 1 }] },
    );
    expect(audit).toEqual({});
  });

  it("normaliza vacíos a null y detecta la diferencia", () => {
    const audit = diffFields({ numero: "" }, { numero: "FAC-1" });
    expect(audit).toEqual({ numero: { llm: null, human: "FAC-1" } });
  });

  it("trata money como número (100 === 100.0)", () => {
    const audit = diffFields({ total: 100 }, { total: 100.0 });
    expect(audit).toEqual({});
  });
});
