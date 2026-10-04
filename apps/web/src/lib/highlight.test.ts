import { describe, expect, it } from "vitest";
import { highlightParts } from "./highlight";

const TEXT = "Ítem 1 de factura · descripción: Instalación eléctrica · cantidad: 1";

function text(parts: { text: string; hit: boolean }[]) {
  return parts.map((part) => part.text).join("");
}

function hits(parts: { text: string; hit: boolean }[]) {
  return parts.filter((part) => part.hit).map((part) => part.text);
}

describe("highlightParts", () => {
  it("marca el token simple", () => {
    const parts = highlightParts(TEXT, "instalación");
    expect(text(parts)).toBe(TEXT);
    expect(hits(parts)).toEqual(["Instalación"]);
  });

  it("ignora acentos y mayúsculas", () => {
    const parts = highlightParts(TEXT, "ELECTRICA descripcion CARACTER");
    expect(hits(parts)).toEqual(["descripción", "eléctrica"]);
    expect(text(parts)).toBe(TEXT);
  });

  it("sin match devuelve una sola parte sin marca", () => {
    const parts = highlightParts(TEXT, "zzz");
    expect(parts).toEqual([{ text: TEXT, hit: false }]);
  });

  it("query multi-token solapada fusiona todo el rango", () => {
    const parts = highlightParts("abababab", "aba bab");
    expect(hits(parts)).toEqual(["abababab"]);
    expect(text(parts)).toBe("abababab");
  });

  it("tokens separados marcan zonas distintas", () => {
    const parts = highlightParts("abxcdyab", "ab cd");
    expect(hits(parts)).toEqual(["ab", "cd", "ab"]);
    expect(text(parts)).toBe("abxcdyab");
  });

  it("query vacía no marca nada", () => {
    const parts = highlightParts(TEXT, "   ");
    expect(parts).toEqual([{ text: TEXT, hit: false }]);
  });

  it("respetar surrogate pairs no rompe el índice", () => {
    const content = "Factura 𝕏 del 2026";
    const parts = highlightParts(content, "factura");
    expect(text(parts)).toBe(content);
    expect(hits(parts)).toEqual(["Factura"]);
  });
});
