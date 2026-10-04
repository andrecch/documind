import { describe, expect, it } from "vitest";
import { chatRequestSchema, citationSchema, type SseEvent } from "./chat";

describe("chatRequestSchema", () => {
  it("acepta un mensaje sin sessionId", () => {
    const parsed = chatRequestSchema.parse({ message: "¿Cuánto costó la instalación?" });
    expect(parsed).toEqual({ message: "¿Cuánto costó la instalación?" });
  });

  it("acepta sessionId uuid y rechaza uno no uuid", () => {
    const valid = "550e8400-e29b-41d4-a716-446655440000";
    expect(chatRequestSchema.parse({ message: "hola", sessionId: valid }).sessionId).toBe(valid);
    expect(() => chatRequestSchema.parse({ message: "hola", sessionId: "no-es-uuid" })).toThrow();
  });

  it("rechaza mensaje vacío (tras trim) o de más de 4000", () => {
    expect(() => chatRequestSchema.parse({ message: "   " })).toThrow();
    expect(() => chatRequestSchema.parse({ message: "" })).toThrow();
    expect(() => chatRequestSchema.parse({ message: "a".repeat(4001) })).toThrow();
    expect(chatRequestSchema.parse({ message: "  hola  " }).message).toBe("hola");
  });
});

describe("citationSchema", () => {
  it("acepta citation de item sin itemIndex", () => {
    const citation = citationSchema.parse({
      documentId: "550e8400-e29b-41d4-a716-446655440000",
      extractionId: "550e8400-e29b-41d4-a716-446655440001",
      chunkKind: "item",
      label: "factura.png (ítem 2)",
    });
    expect(citation.itemIndex).toBeUndefined();
  });

  it("acepta itemIndex null y number", () => {
    const base = {
      documentId: "550e8400-e29b-41d4-a716-446655440000",
      extractionId: "550e8400-e29b-41d4-a716-446655440001",
      chunkKind: "item",
      label: "x",
    };
    expect(citationSchema.parse({ ...base, itemIndex: null }).itemIndex).toBeNull();
    expect(citationSchema.parse({ ...base, itemIndex: 3 }).itemIndex).toBe(3);
  });

  it("rechaza chunkKind fuera de document|item", () => {
    expect(() =>
      citationSchema.parse({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
        extractionId: "550e8400-e29b-41d4-a716-446655440001",
        chunkKind: "chunk",
        label: "x",
      }),
    ).toThrow();
  });
});

describe("SseEvent", () => {
  it("discrimina delta, citations y error", () => {
    const events: SseEvent[] = [
      { type: "delta", text: "Según" },
      {
        type: "citations",
        citations: [
          {
            documentId: "550e8400-e29b-41d4-a716-446655440000",
            extractionId: "550e8400-e29b-41d4-a716-446655440001",
            chunkKind: "document",
            label: "factura.png",
          },
        ],
        messageId: "550e8400-e29b-41d4-a716-446655440002",
        sessionId: "550e8400-e29b-41d4-a716-446655440003",
      },
      { type: "error", code: "LLM_ERROR", message: "proveedor caído" },
    ];
    for (const event of events) {
      if (event.type === "delta") expect(event.text).toBe("Según");
      if (event.type === "citations") expect(event.citations).toHaveLength(1);
      if (event.type === "error") expect(event.code).toBe("LLM_ERROR");
    }
  });
});
