export const DOCUMENT_TYPES = [
  "factura",
  "contrato",
  "recibo",
  "documentacion",
  "propuesta",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
