import { describe, expect, it } from "vitest";
import { searchRequestSchema, type SearchHit, type SearchResponse } from "./search";

describe("searchRequestSchema", () => {
  it("acepta un request mínimo y aplica el default de limit", () => {
    const parsed = searchRequestSchema.parse({ query: "instalación eléctrica" });
    expect(parsed).toEqual({ query: "instalación eléctrica", limit: 6 });
  });

  it("rechaza query más corta que 2 (incluso tras trim)", () => {
    expect(() => searchRequestSchema.parse({ query: "a" })).toThrow();
    expect(() => searchRequestSchema.parse({ query: "   a   " })).toThrow();
  });

  it("rechaza query de más de 500", () => {
    expect(() => searchRequestSchema.parse({ query: "x".repeat(501) })).toThrow();
  });

  it("rechaza limit fuera de 1..20 y acepta límites con coerce", () => {
    expect(() => searchRequestSchema.parse({ query: "prueba consulta", limit: 21 })).toThrow();
    expect(() => searchRequestSchema.parse({ query: "prueba consulta", limit: 0 })).toThrow();
    expect(() => searchRequestSchema.parse({ query: "prueba consulta", limit: 1.5 })).toThrow();
    expect(searchRequestSchema.parse({ query: "prueba consulta", limit: "20" }).limit).toBe(20);
  });

  it("rechaza docType inválido y acepta uno del catálogo", () => {
    expect(() =>
      searchRequestSchema.parse({ query: "prueba consulta", docType: "musica" }),
    ).toThrow();
    expect(
      searchRequestSchema.parse({ query: "prueba consulta", docType: "factura" }).docType,
    ).toBe("factura");
  });

  it("coerce de fechas from/to", () => {
    const parsed = searchRequestSchema.parse({
      query: "prueba consulta",
      from: "2026-01-01",
      to: "2026-12-31T23:59:59Z",
    });
    expect(parsed.from).toBeInstanceOf(Date);
    expect(parsed.to).toBeInstanceOf(Date);
  });
});

describe("tipos de respuesta", () => {
  it("SearchHit/SearchResponse compilan con similarity null en el padre acompañante", () => {
    const response: SearchResponse = {
      tookMs: 12,
      items: [item(), padre()],
    };
    expect(response.items).toHaveLength(2);
    expect(response.items[0].similarity).toBeCloseTo(0.87);
    expect(response.items[1].similarity).toBeNull();
  });
});

function item(): SearchHit {
  return {
    chunkId: "00000000-0000-4000-8000-000000000004",
    documentId: "00000000-0000-4000-8000-000000000002",
    extractionId: "00000000-0000-4000-8000-000000000003",
    filename: "factura.png",
    docType: "factura",
    kind: "item",
    itemIndex: 0,
    content: "Ítem 1 de factura · descripción: Instalación eléctrica…",
    similarity: 0.87,
    createdAt: "2026-10-04T10:00:00.000Z",
  };
}

function padre(): SearchHit {
  return {
    chunkId: "00000000-0000-4000-8000-000000000001",
    documentId: "00000000-0000-4000-8000-000000000002",
    extractionId: "00000000-0000-4000-8000-000000000003",
    filename: "factura.png",
    docType: "factura",
    kind: "document",
    itemIndex: null,
    content: "Factura FAC-2026-0847 emitida por Suministros Andinos S.A.…",
    similarity: null,
    createdAt: "2026-10-04T10:00:00.000Z",
  };
}
