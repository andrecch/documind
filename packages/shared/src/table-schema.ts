import type { DocumentType } from "./document-types";

export type TableColumnType = "text" | "number" | "money";

export type TableColumn = {
  key: string;
  label: string;
  type: TableColumnType;
};

export type TableSchema = {
  id: string;
  title: string;
  columns: TableColumn[];
};

export const DOC_TYPE_TABLE_SCHEMA: Record<DocumentType, TableSchema[]> = {
  factura: [
    {
      id: "items",
      title: "ÍTEMS DE LA FACTURA",
      columns: [
        { key: "descripcion", label: "DESCRIPCIÓN", type: "text" },
        { key: "cantidad", label: "CANT.", type: "number" },
        { key: "valor_unitario", label: "VALOR UNIT.", type: "money" },
        { key: "valor_total", label: "VALOR TOTAL", type: "money" },
      ],
    },
  ],
  propuesta: [
    {
      id: "rubros",
      title: "RUBROS DE LA PROPUESTA",
      columns: [
        { key: "concepto", label: "CONCEPTO", type: "text" },
        { key: "valor", label: "VALOR", type: "money" },
      ],
    },
  ],
  recibo: [
    {
      id: "conceptos",
      title: "CONCEPTOS DEL RECIBO",
      columns: [
        { key: "concepto", label: "CONCEPTO", type: "text" },
        { key: "valor", label: "VALOR", type: "money" },
      ],
    },
  ],
  contrato: [],
  documentacion: [],
};

export function getTablesForDocType(docType: DocumentType): TableSchema[] {
  return DOC_TYPE_TABLE_SCHEMA[docType];
}

export function getRowKeysForDocType(docType: DocumentType): string[] {
  const tables = DOC_TYPE_TABLE_SCHEMA[docType];
  return tables.flatMap((table) => table.columns.map((column) => column.key));
}

export function emptyRowFor(table: TableSchema): Record<string, string | number> {
  const row: Record<string, string | number> = {};
  for (const column of table.columns) {
    row[column.key] = column.type === "text" ? "" : 0;
  }
  return row;
}
