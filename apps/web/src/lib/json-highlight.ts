export type JsonTokenKind = "key" | "string" | "number" | "punct";

export type JsonToken = {
  text: string;
  kind: JsonTokenKind;
};

const TOKEN_RE = /"(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|./g;

/** Tokeniza una línea de JSON para resaltado de sintaxis (lógica pura, testeable). */
export function tokenizeJsonLine(line: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const re = new RegExp(TOKEN_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const tok = m[0];
    const colon = m[1];
    let kind: JsonTokenKind;
    if (tok.startsWith('"')) {
      kind = colon ? "key" : "string";
    } else if (/^(?:true|false|null)$/.test(tok) || /^-?\d/.test(tok)) {
      kind = "number";
    } else {
      kind = "punct";
    }
    tokens.push({ text: tok, kind });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return tokens;
}
