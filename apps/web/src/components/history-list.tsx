"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { DocumentStatus } from "@documind/shared";
import { api, type DocumentSummary } from "@/lib/api";
import { useActiveDoc } from "@/lib/store";

const STATUS_CLASS: Record<DocumentStatus, string> = {
  pending: "border-rule-soft text-text-2",
  processing: "border-rule text-rule",
  ready_for_review: "border-accent text-accent",
  archivado: "border-[color:var(--success)] text-[color:var(--success)]",
  error: "border-accent bg-accent-soft text-accent",
};

export function HistoryList() {
  const t = useTranslations("history");
  const locale = useLocale();
  const router = useRouter();
  const set = useActiveDoc((s) => s.set);
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listDocuments({ limit: 10 })
      .then((res) => {
        if (!cancelled) setDocs(res.items);
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = (doc: DocumentSummary) => {
    set({ docId: doc.id, name: doc.filename, mime: doc.mime, size: doc.sizeBytes });
    router.push(`/${locale}/review`);
  };

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );

  return (
    <section className="mt-10 w-full overflow-hidden rounded-[3px] border-[1.5px] border-rule bg-sheet">
      <div className="flex h-[30px] items-center gap-2 border-b border-rule bg-band px-3.5">
        <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-rule">
          {t("title")}
        </span>
      </div>
      {docs === null ? (
        <p className="px-4 py-4 font-mono text-[11px] tracking-[1.2px] text-text-2">
          {t("loading")}
        </p>
      ) : docs.length === 0 ? (
        <p className="px-4 py-4 font-mono text-[11.5px] text-text-2">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-rule-soft/60">
          {docs.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => open(doc)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-band/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-bold text-text">
                  {doc.filename}
                </span>
                <span className="hidden font-mono text-[10.5px] text-text-3 sm:block">
                  {fmtDate(doc.createdAt)}
                </span>
                <span
                  className={`shrink-0 rounded-[2px] border-2 px-2 py-0.5 font-display text-[9.5px] font-bold uppercase tracking-[1px] ${STATUS_CLASS[doc.status]}`}
                >
                  {t(`statuses.${doc.status}`)}
                </span>
                <ChevronRight size={14} strokeWidth={2} className="shrink-0 text-text-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
