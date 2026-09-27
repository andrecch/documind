import { describe, expect, it } from "vitest";
import { tokenizeJsonLine } from "./json-highlight";

describe("tokenizeJsonLine", () => {
  it("separa clave (con dos puntos), espacio y valor string", () => {
    const tokens = tokenizeJsonLine('"tipo_documento": "factura",');
    expect(tokens.map((t) => t.text)).toEqual(['"tipo_documento":', " ", '"factura"', ","]);
    expect(tokens.map((t) => t.kind)).toEqual(["key", "punct", "string", "punct"]);
  });

  it("detecta números y valores anidados con indentación", () => {
    const tokens = tokenizeJsonLine('  "total": 2915500,');
    expect(tokens[0]).toEqual({ text: " ", kind: "punct" });
    expect(tokens[1]).toEqual({ text: " ", kind: "punct" });
    expect(tokens[2].kind).toBe("key");
    expect(tokens[4].kind).toBe("number");
  });

  it("trata true/false/null como número (misma clase de color)", () => {
    expect(tokenizeJsonLine('"ok": true').map((t) => t.kind)).toEqual(["key", "punct", "number"]);
    expect(tokenizeJsonLine('"x": null').map((t) => t.kind)).toEqual(["key", "punct", "number"]);
  });

  it("tokeniza llaves y líneas vacías", () => {
    expect(tokenizeJsonLine("{").map((t) => t.kind)).toEqual(["punct"]);
    expect(tokenizeJsonLine("")).toEqual([]);
  });

  it("maneja strings con escapes", () => {
    const tokens = tokenizeJsonLine('"nota": "uso \\"interno\\""');
    expect(tokens.some((t) => t.kind === "string")).toBe(true);
  });
});
