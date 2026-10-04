import { describe, expect, it } from "vitest";
import type { SearchHit } from "@documind/shared";
import { buildContext, extractCitations } from "./citations";

function hit(overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    chunkId: "00000000-0000-4000-8000-000000000001",
    documentId: "00000000-0000-4000-8000-000000000002",
    extractionId: "00000000-0000-4000-8000-000000000003",
    filename: "factura.png",
    docType: "factura",
    kind: "document",
    itemIndex: null,
    content: "Factura FAC-2026-0847 emitida por Suministros Andinos S.A.",
    similarity: 0.5,
    createdAt: "2026-10-04T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildContext", () => {
  it("numera los fragments y marca los ítems", () => {
    const context = [
      hit({ filename: "a.pdf" }),
      hit({
        kind: "item",
        itemIndex: 1,
        filename: "a.pdf",
        content: "Ítem 2 · descripción: Materiales",
      }),
    ];
    const block = buildContext(context);
    expect(block).toContain(
      "[1] Factura FAC-2026-0847 emitida por Suministros Andinos S.A. (a.pdf)",
    );
    expect(block).toContain("[2] Ítem 2 · descripción: Materiales (a.pdf · ítem 2)");
  });
});

describe("extractCitations", () => {
  const context = [
    hit({ filename: "a.pdf" }),
    hit({ filename: "b.png" }),
    hit({ filename: "c.png" }),
  ];

  it("toma solo las citas citadas con [n] dentro de rango", () => {
    const citations = extractCitations("El total es 2.915.500 [1], según [2].", context);
    expect(citations.map((c) => c.label)).toEqual(["a.pdf", "b.png"]);
  });

  it("ignora índices fuera de rango", () => {
    const citations = extractCitations("Dato [6] y [99] y [0].", context);
    expect(citations.map((c) => c.label)).toEqual(["a.pdf", "b.png", "c.png"]);
  });

  it("sin citas válidas hace fallback al contexto completo", () => {
    const citations = extractCitations("No lo encuentro en tus documentos.", context);
    expect(citations.map((c) => c.label)).toEqual(["a.pdf", "b.png", "c.png"]);
  });

  it("no duplica entradas citadas dos veces", () => {
    const citations = extractCitations("El total es [1]. Impuestos: ver [1].", context);
    expect(citations.map((c) => c.label)).toEqual(["a.pdf"]);
  });

  it("los chunks hijos exponen itemIndex y label de ítem", () => {
    const itemHit = hit({ kind: "item", itemIndex: 0, filename: "factura.png" });
    const docHit = context[0]!;
    const citations = extractCitations("Costó 890.000 [2].", [docHit, itemHit]);
    expect(citations).toEqual([
      expect.objectContaining({
        documentId: itemHit.documentId,
        extractionId: itemHit.extractionId,
        chunkKind: "item",
        itemIndex: 0,
        label: "factura.png · ítem 1",
      }),
    ]);
  });
});
