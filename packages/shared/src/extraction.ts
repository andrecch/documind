import { z } from "zod";
import { documentTypeSchema } from "./file-validation";
import { DOC_TYPE_TABLE_SCHEMA } from "./table-schema";

export { DOC_TYPE_TABLE_SCHEMA } from "./table-schema";
export type { TableSchema, TableColumn, TableColumnType } from "./table-schema";

export type RowValue = string | number;
export type ExtractionRow = Record<string, RowValue>;

export const extractionResultSchema = z.object({
  doc_type: documentTypeSchema,
  numero: z.string().optional(),
  fecha_emision: z.string().optional(),
  emisor: z
    .object({ nombre: z.string().optional(), identificacion: z.string().optional() })
    .optional(),
  receptor: z
    .object({ nombre: z.string().optional(), identificacion: z.string().optional() })
    .optional(),
  moneda: z.string().length(3).optional(),
  subtotal: z.number().optional(),
  impuestos: z.number().optional(),
  total: z.number().optional(),
  items_total: z.number().optional(),
  items: z
    .array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
    .max(100)
    .optional(),
  confianza: z.number().min(0).max(1),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export const DOCUMENT_STATUSES = [
  "pending",
  "processing",
  "ready_for_review",
  "archivado",
  "error",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const EXTRACTION_STATUSES = ["draft", "confirmed"] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const REVISION_ACTIONS = [
  "created",
  "draft_edit",
  "confirmed",
  "post_confirm_edit",
] as const;
export type RevisionAction = (typeof REVISION_ACTIONS)[number];

export type FieldAuditEntry = { llm: unknown; human: unknown };
export type FieldAudit = Record<string, FieldAuditEntry>;

const nullishToUndefined = (value: unknown): unknown =>
  value === null || value === undefined ? undefined : value;

export function validateExtraction(data: unknown): ExtractionResult {
  const parsed = extractionResultSchema.parse(data);
  const tables = DOC_TYPE_TABLE_SCHEMA[parsed.doc_type];
  const allowedKeys = new Set(tables.flatMap((table) => table.columns.map((c) => c.key)));

  if (parsed.items) {
    parsed.items = parsed.items
      .map((row) => {
        const clean: Record<string, RowValue> = {};
        for (const [key, value] of Object.entries(row)) {
          const normalized = nullishToUndefined(value);
          if (normalized === undefined) continue;
          if (allowedKeys.has(key)) clean[key] = normalized as RowValue;
        }
        return clean;
      })
      .filter((row) => Object.keys(row).length > 0);
    if (parsed.items.length === 0) parsed.items = undefined;
  }

  return parsed;
}

export const SAMPLE_EXTRACTION: ExtractionResult = {
  doc_type: "factura",
  numero: "FAC-2026-0847",
  fecha_emision: "2026-09-12",
  emisor: { nombre: "Suministros Andinos S.A.", identificacion: "901.245.678-1" },
  receptor: { nombre: "Constructora Delta Ltda." },
  moneda: "COP",
  subtotal: 2450000,
  impuestos: 465500,
  total: 2915500,
  items_total: 2450000,
  items: [
    {
      descripcion: "Instalación eléctrica",
      cantidad: 1,
      valor_unitario: 890000,
      valor_total: 890000,
    },
    { descripcion: "Materiales", cantidad: 12, valor_unitario: 130000, valor_total: 1560000 },
  ],
  confianza: 0.97,
};
