"use client";
import type { SearchHit } from "@documind/shared";
import { highlightParts } from "@/lib/highlight";
import { useTranslations } from "next-intl";

const TYPE_PILL_CLASS: Record<string, string> = {
  factura: "border-rule-soft text-text-2",
  contrato: "border-rule text-rule",
  recibo: "border-rule-soft text-text-2",
  documentacion: "border-rule-soft text-text-2",
  propuesta: "border-rule-soft text-text-2",
};

export function SearchResults({
  items,
  query,
  onOpen,
}: {
  items: SearchHit[];
  query: string;
  onOpen: (hit: SearchHit) => void;
}) {
  const t = useTranslations("search");
  const tt = useTranslations("review");
  return (
    <ul className="divide-y divide-rule-soft/60">
      {items.map((hit) => {
        const parts = highlightParts(hit.content, query);
        return (
          <li key={hit.chunkId}>
            <button
              type="button"
              onClick={() => onOpen(hit)}
              className="flex w-full flex-col items-start gap-1.5 px-4 py-3 text-left transition hover:bg-band/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <div className="flex w-full items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-bold text-text">
                  {hit.filename}
                </span>
                <span
                  className={`shrink-0 rounded-[2px] border-2 px-2 py-0.5 font-display text-[9.5px] font-bold uppercase tracking-[1px] ${TYPE_PILL_CLASS[hit.docType]}`}
                >
                  {tt(`types.${hit.docType}`)}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-text-2">
                  {hit.similarity == null
                    ? "·"
                    : t("relevance", { percent: Math.round(hit.similarity * 100) })}
                </span>
              </div>
              <p className="line-clamp-3 font-mono text-[11.5px] leading-[1.6] text-text-2">
                {parts.map((part, index) =>
                  part.hit ? (
                    <mark
                      key={index}
                      className="bg-accent-soft font-bold text-text underline decoration-accent-soft"
                    >
                      {part.text}
                    </mark>
                  ) : (
                    <span key={index}>{part.text}</span>
                  ),
                )}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
