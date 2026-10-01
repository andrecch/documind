import type { DocumentType, ExtractionResult } from "@documind/shared";
import { DOC_TYPE_TABLE_SCHEMA } from "@documind/shared";

export type FieldKind = "text" | "date" | "textarea" | "number";

export type FieldLabelKey =
  | "numero"
  | "fechaEmision"
  | "moneda"
  | "emisorNombre"
  | "emisorId"
  | "receptorNombre"
  | "receptorId"
  | "subtotal"
  | "impuestos"
  | "total"
  | "itemsTotal"
  | "objeto"
  | "partes"
  | "fechaInicio"
  | "fechaFin"
  | "valor"
  | "alcance"
  | "entidad"
  | "vigencia"
  | "entidades"
  | "referencia"
  | "asunto"
  | "contenido";

export type FieldSpec = { path: string; kind: FieldKind; label: FieldLabelKey };

export const FICHA_FIELDS: Record<DocumentType, FieldSpec[]> = {
  factura: [
    { path: "numero", kind: "text", label: "numero" },
    { path: "fecha_emision", kind: "date", label: "fechaEmision" },
    { path: "moneda", kind: "text", label: "moneda" },
    { path: "emisor.nombre", kind: "text", label: "emisorNombre" },
    { path: "emisor.identificacion", kind: "text", label: "emisorId" },
    { path: "receptor.nombre", kind: "text", label: "receptorNombre" },
    { path: "receptor.identificacion", kind: "text", label: "receptorId" },
    { path: "subtotal", kind: "number", label: "subtotal" },
    { path: "impuestos", kind: "number", label: "impuestos" },
    { path: "total", kind: "number", label: "total" },
    { path: "items_total", kind: "number", label: "itemsTotal" },
  ],
  recibo: [
    { path: "numero", kind: "text", label: "numero" },
    { path: "fecha_emision", kind: "date", label: "fechaEmision" },
    { path: "moneda", kind: "text", label: "moneda" },
    { path: "emisor.nombre", kind: "text", label: "emisorNombre" },
    { path: "receptor.nombre", kind: "text", label: "receptorNombre" },
    { path: "total", kind: "number", label: "total" },
    { path: "items_total", kind: "number", label: "itemsTotal" },
  ],
  contrato: [
    { path: "numero", kind: "text", label: "numero" },
    { path: "objeto", kind: "textarea", label: "objeto" },
    { path: "partes", kind: "textarea", label: "partes" },
    { path: "fecha_inicio", kind: "date", label: "fechaInicio" },
    { path: "fecha_fin", kind: "date", label: "fechaFin" },
    { path: "valor", kind: "number", label: "valor" },
    { path: "moneda", kind: "text", label: "moneda" },
  ],
  propuesta: [
    { path: "numero", kind: "text", label: "numero" },
    { path: "fecha_emision", kind: "date", label: "fechaEmision" },
    { path: "alcance", kind: "textarea", label: "alcance" },
    { path: "entidad", kind: "text", label: "entidad" },
    { path: "vigencia", kind: "text", label: "vigencia" },
    { path: "valor", kind: "number", label: "valor" },
    { path: "items_total", kind: "number", label: "itemsTotal" },
    { path: "moneda", kind: "text", label: "moneda" },
  ],
  documentacion: [
    { path: "referencia", kind: "text", label: "referencia" },
    { path: "fecha_emision", kind: "date", label: "fechaEmision" },
    { path: "entidades", kind: "text", label: "entidades" },
    { path: "asunto", kind: "text", label: "asunto" },
    { path: "contenido", kind: "textarea", label: "contenido" },
  ],
};

export type EditableFicha = {
  doc_type: DocumentType;
  fields: Record<string, string>;
  items: Record<string, string>[];
};

export function parseNumeric(raw: string): number | undefined {
  const value = raw.trim();
  if (value === "") return undefined;
  if (value.includes(",")) {
    const es = Number(value.replaceAll(".", "").replace(",", "."));
    return Number.isFinite(es) ? es : undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function getIn(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function setIn(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".");
  let current = target;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[segments[segments.length - 1] as string] = value;
}

export function fromExtraction(result: ExtractionResult): EditableFicha {
  const fields: Record<string, string> = {};
  for (const spec of FICHA_FIELDS[result.doc_type]) {
    const value = getIn(result, spec.path);
    fields[spec.path] = value == null ? "" : String(value);
  }
  const items = (result.items ?? []).map((row) => {
    const editable: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) editable[key] = String(value);
    return editable;
  });
  return { doc_type: result.doc_type, fields, items };
}

export function toExtraction(ficha: EditableFicha, confianza: number): ExtractionResult {
  const out: Record<string, unknown> = { doc_type: ficha.doc_type, confianza };
  for (const spec of FICHA_FIELDS[ficha.doc_type]) {
    const raw = (ficha.fields[spec.path] ?? "").trim();
    if (raw === "") continue;
    if (spec.kind === "number") {
      const parsed = parseNumeric(raw);
      if (parsed === undefined) continue;
      setIn(out, spec.path, parsed);
    } else {
      setIn(out, spec.path, raw);
    }
  }
  const allowedKeys = new Set(
    DOC_TYPE_TABLE_SCHEMA[ficha.doc_type].flatMap((table) => table.columns.map((c) => c.key)),
  );
  const items: Record<string, string | number>[] = [];
  for (const row of ficha.items) {
    const clean: Record<string, string | number> = {};
    for (const [key, rawValue] of Object.entries(row)) {
      if (!allowedKeys.has(key)) continue;
      const value = rawValue.trim();
      if (value === "") continue;
      const isNumeric = DOC_TYPE_TABLE_SCHEMA[ficha.doc_type].some((table) =>
        table.columns.some((c) => c.key === key && c.type !== "text"),
      );
      if (isNumeric) {
        const parsed = parseNumeric(value);
        if (parsed === undefined) continue;
        clean[key] = parsed;
      } else {
        clean[key] = value;
      }
    }
    if (Object.keys(clean).length > 0) items.push(clean);
  }
  if (items.length > 0) out.items = items;
  return out as ExtractionResult;
}

export function itemsTotalsMismatch(
  ficha: EditableFicha,
): { expected: number; declared: number } | null {
  const declared = parseNumeric(ficha.fields["items_total"] ?? "");
  if (declared === undefined || ficha.items.length === 0) return null;
  const columns = DOC_TYPE_TABLE_SCHEMA[ficha.doc_type].flatMap((table) => table.columns);
  const moneyColumn = [...columns].reverse().find((column) => column.type === "money");
  const totalColumn =
    moneyColumn ?? [...columns].reverse().find((column) => column.type !== "text");
  if (!totalColumn) return null;
  let sum = 0;
  let any = false;
  for (const row of ficha.items) {
    const value = parseNumeric(row[totalColumn.key] ?? "");
    if (value === undefined) continue;
    sum += value;
    any = true;
  }
  if (!any || sum === declared) return null;
  return { expected: sum, declared };
}
