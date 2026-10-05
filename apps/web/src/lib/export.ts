import type { DocumentType, ExtractionResult, FieldAudit, RowValue } from "@documind/shared";
import { DOC_TYPE_TABLE_SCHEMA } from "@documind/shared";

export function downloadBlob(content: string, mime: string, filename: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function fichaJson(f: {
  documentId: string;
  filename: string;
  docType: DocumentType;
  extraction: ExtractionResult;
  fieldAudit: FieldAudit | null;
  tokens: { prompt: number; completion: number };
}): string {
  return JSON.stringify(
    {
      document_id: f.documentId,
      filename: f.filename,
      doc_type: f.docType,
      confirmed_data: f.extraction,
      field_audit: f.fieldAudit,
      tokens: f.tokens,
      exported_at: new Date().toISOString(),
    },
    null,
    2,
  );
}

function csvCell(value: RowValue | undefined): string {
  if (value === undefined || value === null) return "";
  const escaped = String(value).replaceAll('"', '""');
  return /[;\n\r"]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function itemsCsv(docType: DocumentType, items: Record<string, RowValue>[]): string {
  const columns = DOC_TYPE_TABLE_SCHEMA[docType].flatMap((table) => table.columns);
  if (items.length === 0 || columns.length === 0) return "";
  const header = columns.map((column) => csvCell(column.label)).join(";");
  const rows = items.map((row) => columns.map((column) => csvCell(row[column.key])).join(";"));
  return `\uFEFF${header}\r\n${rows.join("\r\n")}`;
}
