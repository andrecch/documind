import type { ExtractionResult, RowValue, TableSchema } from "@documind/shared";
import { getTablesForDocType } from "@documind/shared";

function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(" · ");
}

function str(value: string | number | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

export function naturalTextForDocument(data: ExtractionResult): string {
  const emisor = data.emisor ? str(data.emisor.nombre) : null;
  const emisorId = data.emisor ? str(data.emisor.identificacion) : null;
  const receptor = data.receptor ? str(data.receptor.nombre) : null;
  const money = (n: number | undefined): string | null =>
    n === undefined ? null : `${str(data.moneda) ?? ""} ${n}`.trim();

  switch (data.doc_type) {
    case "factura":
      return joinParts([
        `Factura ${str(data.numero) ?? "sin número"}`,
        emisor && `emitida por ${emisor}${emisorId ? ` (${emisorId})` : ""}`,
        receptor && `a favor de ${receptor}`,
        str(data.fecha_emision) && `fecha ${data.fecha_emision}`,
        money(data.subtotal) && `subtotal ${money(data.subtotal)}`,
        money(data.impuestos) && `impuestos ${money(data.impuestos)}`,
        money(data.total) && `total ${money(data.total)}`,
      ]);
    case "recibo":
      return joinParts([
        `Recibo ${str(data.numero) ?? "sin número"}`,
        emisor && `emitido por ${emisor}`,
        receptor && `para ${receptor}`,
        str(data.fecha_emision) && `fecha ${data.fecha_emision}`,
        money(data.total) && `importe ${money(data.total)}`,
      ]);
    case "contrato":
      return joinParts([
        `Contrato ${str(data.numero) ?? "sin número"}`,
        str(data.objeto) && `objeto: ${str(data.objeto)}`,
        str(data.partes) && `partes: ${str(data.partes)}`,
        (str(data.fecha_inicio) || str(data.fecha_fin)) &&
          `vigencia ${str(data.fecha_inicio) ?? "?"} a ${str(data.fecha_fin) ?? "?"}`,
        money(data.valor) && `valor ${money(data.valor)}`,
      ]);
    case "propuesta":
      return joinParts([
        `Propuesta ${str(data.numero) ?? "sin número"}`,
        str(data.alcance) && `alcance: ${str(data.alcance)}`,
        str(data.entidad) && `para ${str(data.entidad)}`,
        str(data.vigencia) && `vigencia ${str(data.vigencia)}`,
        money(data.valor) && `valor ${money(data.valor)}`,
      ]);
    case "documentacion":
      return joinParts([
        `Documentación ${str(data.referencia) ?? "sin referencia"}`,
        str(data.entidades) && `entidades: ${str(data.entidades)}`,
        str(data.fecha_emision) && `fecha ${data.fecha_emision}`,
        str(data.asunto) && `asunto: ${str(data.asunto)}`,
        str(data.contenido),
      ]);
  }
}

export function naturalTextForItem(
  data: ExtractionResult,
  table: TableSchema,
  rowIndex: number,
  row: Record<string, RowValue | null | undefined>,
): string {
  const cells = table.columns
    .map((column) => {
      const value = row[column.key];
      if (value === undefined || String(value).trim() === "") return null;
      return `${column.label}: ${value}`;
    })
    .filter((c): c is string => c !== null);
  return joinParts([`Ítem ${rowIndex + 1} de ${data.doc_type}`, ...cells]);
}

export function naturalTextsForExtraction(data: ExtractionResult): {
  document: string;
  items: { itemIndex: number; content: string }[];
} {
  const tables = getTablesForDocType(data.doc_type);
  const items: { itemIndex: number; content: string }[] = [];
  if (tables.length > 0 && data.items) {
    const table = tables[0];
    if (table) {
      data.items.forEach((row, index) => {
        items.push({ itemIndex: index, content: naturalTextForItem(data, table, index, row) });
      });
    }
  }
  return { document: naturalTextForDocument(data), items };
}
