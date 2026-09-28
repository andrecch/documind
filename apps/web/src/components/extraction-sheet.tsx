"use client";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { ExtractionResult, TableColumn } from "@documind/shared";
import { getTablesForDocType } from "@documind/shared";
import { tokenizeJsonLine, type JsonTokenKind } from "@/lib/json-highlight";

const TOKEN_CLASS: Record<JsonTokenKind, string> = {
  key: "text-carbon-key",
  string: "text-carbon-text",
  number: "text-carbon-number",
  punct: "text-carbon-soft",
};

function CarbonLine({ line, ix }: { line: string; ix: number }) {
  return (
    <div>
      {tokenizeJsonLine(line).map((t, k) => (
        <span key={`${ix}-${k}`} className={TOKEN_CLASS[t.kind]}>
          {t.text}
        </span>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule-soft/60 pb-2 last:border-b-0 last:pb-0">
      <span className="shrink-0 font-display text-[10px] font-bold uppercase tracking-[1px] text-text-3">
        {label}
      </span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

/** Mitad derecha (comp V2): la hoja rellenada por la IA + la copia carbón. */
export function ExtractionSheet({ value, docName }: { value: ExtractionResult; docName: string }) {
  const t = useTranslations("review");
  const locale = useLocale();
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);
  const carbonLines = useMemo(() => text.split("\n"), [text]);
  const num = (n: number) => new Intl.NumberFormat(locale).format(n);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const onDownload = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = "extraccion.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-bg">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-6">
        <span className="font-mono text-[13.5px] font-bold text-text">{docName}</span>
        <span className="flex-1" />
        <span className="flex items-center gap-2 rounded-full border border-rule-soft bg-sheet px-3 py-1.5 font-display text-[10.5px] font-bold uppercase tracking-[1.2px] text-[color:var(--success)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />
          {t("status")}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto flex max-w-[720px] flex-col gap-4">
          <div className="overflow-hidden rounded-[3px] border-[1.5px] border-rule bg-sheet">
            <div className="flex h-[30px] items-center gap-2 border-b border-rule bg-band px-3.5">
              <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-rule">
                {t("sheet")}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={onCopy}
                className="font-display text-[10px] font-bold uppercase tracking-[1px] text-rule hover:underline"
              >
                {copied ? t("copied") : t("copy")}
              </button>
              <span className="text-text-3">·</span>
              <button
                type="button"
                onClick={onDownload}
                className="font-display text-[10px] font-bold uppercase tracking-[1px] text-rule hover:underline"
              >
                {t("download")}
              </button>
            </div>
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <Row label={t("f1")}>
                <span className="font-mono text-[12px] font-bold text-text">{docName}</span>
              </Row>
              <Row label={t("f2")}>
                <span className="inline-block rounded-[2px] border-2 border-accent px-2.5 py-0.5 font-mono text-[12px] font-bold uppercase tracking-[1.2px] text-accent">
                  {value.doc_type}
                </span>
              </Row>
              <Row label={t("f3")}>
                <span className="font-mono text-[12.5px] font-bold text-text">
                  {(value.fecha_emision ?? "").replaceAll("-", " / ")}
                </span>
              </Row>
              <Row label={t("f4")}>
                <span className="font-mono text-[12.5px] font-bold text-text">
                  {value.moneda} {value.total == null ? "—" : num(value.total)}
                </span>
              </Row>
              <div className="border-b border-rule-soft pb-2">
                <p className="font-display text-[10px] font-bold uppercase tracking-[1px] text-text-3">
                  {t("f5")}
                </p>
                <p className="mt-0.5 font-mono text-[12px] font-bold text-text">
                  {value.emisor?.nombre ?? "—"}
                  {value.emisor?.identificacion ? ` · ${value.emisor.identificacion}` : ""}
                </p>
                <p className="mt-1 font-display text-[10px] font-bold uppercase tracking-[1px] text-text-3">
                  {t("receptor")}
                </p>
                <p className="mt-0.5 font-mono text-[12px] font-bold text-text">
                  {value.receptor?.nombre ?? "—"}
                </p>
              </div>
              <Row label={t("f6")}>
                <span className="font-mono text-[12.5px] font-bold text-[color:var(--success)]">
                  {value.confianza}
                </span>
              </Row>
              {value.items && value.items.length > 0 && (
                <div className="border-b border-rule-soft pb-2">
                  <p className="font-display text-[10px] font-bold uppercase tracking-[1px] text-text-3">
                    {t("items")} ({value.items.length})
                  </p>
                  <div className="mt-1 flex flex-col gap-1">
                    {value.items.map((row, ix) => {
                      const table = getTablesForDocType(value.doc_type)[0];
                      const textColumn = table?.columns.find((c: TableColumn) => c.type === "text");
                      const valueColumn = [...(table?.columns ?? [])]
                        .reverse()
                        .find((c: TableColumn) => c.type !== "text");
                      const text = textColumn ? row[textColumn.key] : undefined;
                      const amount = valueColumn ? row[valueColumn.key] : undefined;
                      return (
                        <p key={ix} className="font-mono text-[11.5px] text-text">
                          {ix + 1} · {text == null || text === "" ? "—" : text}
                          {amount != null
                            ? ` — ${typeof amount === "number" ? num(amount) : amount}`
                            : ""}
                        </p>
                      );
                    })}
                    <div className="mt-1 flex items-center justify-between border-t border-rule-soft pt-1.5">
                      <span className="font-mono text-[11px] text-text-2">
                        {t("subtotal", {
                          subtotal: value.subtotal == null ? "—" : num(value.subtotal),
                          tax: value.impuestos == null ? "—" : num(value.impuestos),
                        })}
                      </span>
                      <span className="font-mono text-[12px] font-bold text-accent">
                        {t("f4")} {value.moneda} {value.total == null ? "—" : num(value.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="shrink-0 px-6 pb-5">
        <div className="flex items-center gap-2" aria-hidden>
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i} className="h-1 w-1 rounded-full bg-rule-soft" />
          ))}
        </div>
        <div className="bg-carbon px-6 py-4">
          {full ? (
            <pre className="max-h-[46vh] overflow-auto font-mono text-[11.5px] leading-[1.6]">
              {carbonLines.map((l, ix) => (
                <CarbonLine key={ix} line={l} ix={ix} />
              ))}
            </pre>
          ) : (
            <>
              <p className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-carbon-key">
                {t("extracted")}
              </p>
              <p className="mt-1 truncate font-mono text-[11.5px] text-carbon-text">
                {'{"doc_type": "'}
                {value.doc_type}
                {'", "total": '}
                {value.total == null ? "…" : num(value.total)}
                {', "confianza": '}
                {value.confianza}
                {"}"}
              </p>
            </>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[10px] text-carbon-soft">qwen/qwen3.8-27b:free</span>
            <button
              type="button"
              onClick={() => setFull(!full)}
              className="font-display text-[10.5px] font-bold uppercase tracking-[1.2px] text-carbon-key hover:underline"
            >
              {full ? t("form") : t("full")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
