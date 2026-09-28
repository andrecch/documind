import { describe, expect, it } from "vitest";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, validateFile } from "./file-validation";
import { extractionResultSchema, SAMPLE_EXTRACTION } from "./extraction";
import { DOCUMENT_TYPES } from "./document-types";

describe("validateFile", () => {
  it("acepta image/png dentro del límite", () => {
    expect(validateFile({ type: "image/png", size: 1024 })).toEqual({ ok: true, error: null });
  });
  it("rechaza tipos no admitidos", () => {
    expect(validateFile({ type: "application/zip", size: 10 })).toEqual({
      ok: false,
      error: "unsupported-type",
    });
  });
  it("rechaza archivos mayores a 20 MB", () => {
    expect(validateFile({ type: "application/pdf", size: MAX_FILE_SIZE_BYTES + 1 })).toEqual({
      ok: false,
      error: "file-too-large",
    });
  });
  it("declara los 4 MIME permitidos", () => {
    expect([...ACCEPTED_MIME_TYPES]).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);
  });
});

describe("extractionResultSchema", () => {
  it("parsea la extracción de muestra", () => {
    expect(extractionResultSchema.parse(SAMPLE_EXTRACTION).doc_type).toBe("factura");
  });
  it("rechaza un tipo de documento desconocido", () => {
    expect(extractionResultSchema.safeParse({ doc_type: "tomografia" }).success).toBe(false);
  });
  it("valida confianza entre 0 y 1", () => {
    expect(extractionResultSchema.safeParse({ doc_type: "factura", confianza: 1.2 }).success).toBe(
      false,
    );
  });
  it("tiene los 5 tipos de documento", () => {
    expect([...DOCUMENT_TYPES]).toEqual([
      "factura",
      "contrato",
      "recibo",
      "documentacion",
      "propuesta",
    ]);
  });
});
