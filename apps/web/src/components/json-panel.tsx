"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ExtractionResult } from "@documind/shared";

function renderLine(line: string, ix: number) {
  const re = /"(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|./g;
  const out: React.ReactNode[] = [];
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    const tok = m[0];
    const colon = m[1];
    const cls = tok.startsWith('"')
      ? colon
        ? "text-[color:var(--json-key)]"
        : "text-[color:var(--json-string)]"
      : /^(true|false|null)$/.test(tok)
        ? "text-[color:var(--json-number)]"
        : /^-?\d/.test(tok)
          ? "text-[color:var(--json-number)]"
          : "text-[color:var(--json-punct)]";
    out.push(
      <span key={`${ix}-${k++}`} className={cls}>
        {tok}
      </span>
    );
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

export function JsonPanel({ value }: { value: ExtractionResult }) {
  const t = useTranslations("review");
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);

  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onDownload = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = "extraccion.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col border-l border-border bg-surface">
      <header className="flex h-[52px] items-center gap-2.5 px-5">
        <span className="font-mono text-[11px] font-medium tracking-[1.4px] text-text-3">{t("panel")}</span>
        <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.8px] text-[color:var(--json-key)]">
          {value.tipo_documento.toUpperCase()}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] text-text-2 hover:text-text"
        >
          {copied ? t("copied") : t("copy")}
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] text-text-2 hover:text-text"
        >
          {t("download")}
        </button>
      </header>
      <div className="flex-1 overflow-auto p-5">
        <pre className="font-mono text-[13px] leading-[1.65]">
          {text.split("\n").map((l, ix) => (
            <div key={ix}>{renderLine(l, ix)}</div>
          ))}
        </pre>
      </div>
      <footer className="flex h-10 items-center justify-between border-t border-border px-5 font-mono text-[11px] text-text-3">
        <span>qwen/qwen3.8-27b:free</span>
        <span>datos de muestra · M0</span>
      </footer>
    </section>
  );
}
