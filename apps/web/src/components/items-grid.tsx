"use client";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import type { DocumentType } from "@documind/shared";
import { getTablesForDocType } from "@documind/shared";

export function ItemsGrid({
  docType,
  rows,
  disabled,
  onRowsChange,
}: {
  docType: DocumentType;
  rows: Record<string, string>[];
  disabled?: boolean;
  onRowsChange: (rows: Record<string, string>[]) => void;
}) {
  const t = useTranslations("review");
  const tables = getTablesForDocType(docType);
  if (tables.length === 0) return null;

  const columns = tables.flatMap((table) => table.columns);

  const emptyRow = (): Record<string, string> => {
    const row: Record<string, string> = {};
    for (const column of columns) row[column.key] = "";
    return row;
  };

  const setCell = (index: number, key: string, value: string) => {
    onRowsChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  return (
    <div className="border-b border-rule-soft pb-2">
      {tables.map((table) => (
        <div key={table.id} className="flex flex-col gap-1.5">
          <p className="font-display text-[10px] font-bold uppercase tracking-[1px] text-text-3">
            {table.title}
          </p>
          <div
            className="grid gap-x-2 gap-y-1"
            style={{
              gridTemplateColumns: `1.6rem repeat(${table.columns.length}, minmax(0, 1fr)) 1.8rem`,
            }}
          >
            <span aria-hidden />
            {table.columns.map((column) => (
              <span
                key={column.key}
                className="font-mono text-[9.5px] uppercase tracking-[0.8px] text-text-3"
              >
                {column.label}
              </span>
            ))}
            <span aria-hidden />
            {rows.map((row, index) => (
              <RowCells
                key={index}
                index={index}
                row={row}
                table={table}
                disabled={disabled}
                onCell={setCell}
                onRemove={() => onRowsChange(rows.filter((_, i) => i !== index))}
              />
            ))}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onRowsChange([...rows, emptyRow()])}
              className="mt-1 flex items-center gap-1 self-start rounded-[2px] border border-rule-soft px-2 py-1 font-display text-[9.5px] font-bold uppercase tracking-[1px] text-text-2 transition hover:border-rule hover:text-rule"
            >
              <Plus size={11} strokeWidth={2} />
              {t("addRow")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function RowCells({
  index,
  row,
  table,
  disabled,
  onCell,
  onRemove,
}: {
  index: number;
  row: Record<string, string>;
  table: ReturnType<typeof getTablesForDocType>[number];
  disabled?: boolean;
  onCell: (index: number, key: string, value: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("review");
  return (
    <>
      <span className="self-center font-mono text-[10.5px] text-text-3">{index + 1}</span>
      {table.columns.map((column) => (
        <input
          key={column.key}
          type="text"
          inputMode={column.type === "text" ? "text" : "decimal"}
          value={row[column.key] ?? ""}
          disabled={disabled}
          onChange={(e) => onCell(index, column.key, e.target.value)}
          className="min-w-0 border-0 border-b border-rule-soft bg-transparent px-0.5 py-1 font-mono text-[11.5px] text-text outline-none transition focus:border-accent focus-visible:outline-none disabled:opacity-50"
          aria-label={`${t("row")} ${index + 1} · ${column.label}`}
        />
      ))}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={t("removeRow")}
        className="self-center text-text-3 transition hover:text-accent disabled:opacity-40"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </>
  );
}
