import { DOC_TYPE_TABLE_SCHEMA } from "@documind/shared";
import type { DocumentType } from "@documind/shared";

export const EXTRACTION_JSON_SCHEMA = {
  name: "extraction_result",
  strict: false,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      doc_type: {
        type: "string",
        enum: Object.keys(DOC_TYPE_TABLE_SCHEMA),
      },
      numero: { type: "string" },
      fecha_emision: { type: "string" },
      emisor: {
        type: "object",
        additionalProperties: false,
        properties: { nombre: { type: "string" }, identificacion: { type: "string" } },
      },
      receptor: {
        type: "object",
        additionalProperties: false,
        properties: { nombre: { type: "string" }, identificacion: { type: "string" } },
      },
      moneda: { type: "string" },
      subtotal: { type: "number" },
      impuestos: { type: "number" },
      total: { type: "number" },
      items_total: { type: "number" },
      objeto: { type: "string" },
      partes: { type: "string" },
      fecha_inicio: { type: "string" },
      fecha_fin: { type: "string" },
      valor: { type: "number" },
      alcance: { type: "string" },
      entidad: { type: "string" },
      vigencia: { type: "string" },
      entidades: { type: "string" },
      referencia: { type: "string" },
      asunto: { type: "string" },
      contenido: { type: "string" },
      items: {
        type: "array",
        maxItems: 100,
        items: { type: "object" },
      },
      confianza: { type: "number" },
    },
    required: ["doc_type", "confianza"],
  },
} as const;

function describeDocType(docType: DocumentType): string {
  const tables = DOC_TYPE_TABLE_SCHEMA[docType];
  if (tables.length === 0) return `- ${docType}: sin tabla de ítems (deja "items" ausente)`;
  const lines = tables.flatMap((table) =>
    table.columns.map((column) => `    - ${column.key} (${column.label}) tipo ${column.type}`),
  );
  return `- ${docType}: "items" es una lista de filas con estas claves exactas:\n${lines.join("\n")}`;
}

export function buildExtractionSystemPrompt(): string {
  const byType = (Object.keys(DOC_TYPE_TABLE_SCHEMA) as DocumentType[])
    .map(describeDocType)
    .join("\n");
  return [
    "Eres el motor OCR de DocuMind. Recibirás las páginas de UN documento en orden.",
    "Extrae los datos y responde SOLO con un JSON válido que respete el JSON Schema indicado.",
    "Reglas:",
    "- Elige doc_type entre: factura, contrato, recibo, documentacion, propuesta.",
    "- Síntesis global: los campos raíz se derivan de TODAS las páginas como un solo documento.",
    "- Números sin separadores de miles ni símbolo de moneda (ej. 890000).",
    "- Fecha en formato YYYY-MM-DD. Moneda: código ISO de 3 letras si aparece.",
    "- Si un campo raíz no aparece en el documento, OMITE la clave; nunca la mandes null ni vacía.",
    "- items: una fila por línea de la tabla del documento, solo con las claves del doc_type elegido.",
    "- items_total: suma de los totales de las filas cuando la tabla tenga totales.",
    "- campos raíz adicionales según doc_type (usa SOLO los de tu tipo):",
    "  - contrato: objeto (qué regula), partes (quién firma), fecha_inicio, fecha_fin, valor (number).",
    "  - propuesta: alcance (qué se ofrece), entidad (a quién), vigencia (until cuándo), valor (number).",
    "  - documentacion: entidades (organizaciones), referencia (código/oficio), asunto, contenido (resumen fiel).",
    "  - factura y recibo: no usan campos adicionales.",
    "- confianza: tu seguridad global de 0 a 1.",
    "Columnas de ítems por tipo de documento:",
    byType,
  ].join("\n");
}

export function buildCorrectionPrompt(rawText: string, errorMessage: string): string {
  return [
    "Tu respuesta anterior no era JSON válido o no respetaba el esquema.",
    `Error de validación: ${errorMessage}`,
    "Corrige y responde SOLO con el JSON final, sin texto adicional ni bloques de código.",
    "Respuesta anterior:",
    rawText.slice(0, 4000),
  ].join("\n");
}
