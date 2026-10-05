"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  type DocumentStatus,
  type DocumentType,
} from "@documind/shared";
import { api, type DocumentSummary } from "@/lib/api";
import { useActiveDoc } from "@/lib/store";

const PAGE_SIZE = 20;

const STATUS_CLASS: Record<DocumentStatus, string> = {
  pending: "border-rule-soft text-text-2",
  processing: "border-rule text-rule",
  ready_for_review: "border-accent text-accent",
  archivado: "border-[color:var(--success)] text-[color:var(--success)]",
  error: "border-accent bg-accent-soft text-accent",
};

const FILTER_CLASS =
  "min-w-0 rounded-[3px] border border-rule-soft bg-transparent px-2 py-1 font-mono text-[11px] text-text outline-none transition focus:border-rule";

export function HistoryList() {
  const t = useTranslations("history");
  const tt = useTranslations("review");
  const locale = useLocale();
  const router = useRouter();
  const set = useActiveDoc((s) => s.set);
  const [docType, setDocType] = useState<DocumentType | "">("");
  const [status, setStatus] = useState<DocumentStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true);
      try {
        const res = await api.listDocuments({
          status: status === "" ? undefined : status,
          docType: docType === "" ? undefined : docType,
          q: q.trim() === "" ? undefined : q.trim(),
          from: from === "" ? undefined : from,
          to: to === "" ? undefined : to,
          limit: PAGE_SIZE,
          offset,
        });
        setTotal(res.total);
        setDocs((prev) => {
          if (!append) return res.items;
          const seen = new Set(prev.map((d) => d.id));
          return [...prev, ...res.items.filter((d) => !seen.has(d.id))];
        });
      } catch {
        if (!append) {
          setDocs([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
      }
    },
    [status, docType, q, from, to],
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  const open = (doc: DocumentSummary) => {
    set({ docId: doc.id, name: doc.filename, mime: doc.mime, size: doc.sizeBytes });
    router.push(`/${locale}/review`);
  };

  const changeQ = (value: string) => {
    setQInput(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQ(value), 300);
  };

  const applySearch = () => {
    if (debounce.current) {
      clearTimeout(debounce.current);
      debounce.current = null;
    }
    setQ(qInput);
    void load(0, false);
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
        <span className="flex-1" />
        <span className="font-mono text-[10px] text-text-3">
          {t("filters.results", { count: total })}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2 border-b border-rule-soft/60 px-4 py-3">
        <label className="flex items-center gap-1.5">
          <span className="font-display text-[9.5px] font-bold uppercase tracking-[1px] text-text-3">
            {t("filters.type")}
          </span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType | "")}
            className={FILTER_CLASS}
          >
            <option value="">{t("filters.all")}</option>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {tt(`types.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="font-display text-[9.5px] font-bold uppercase tracking-[1px] text-text-3">
            {t("filters.status")}
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DocumentStatus | "")}
            className={FILTER_CLASS}
          >
            <option value="">{t("filters.all")}</option>
            {DOCUMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`statuses.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="font-display text-[9.5px] font-bold uppercase tracking-[1px] text-text-3">
            {t("filters.from")}
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={FILTER_CLASS}
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="font-display text-[9.5px] font-bold uppercase tracking-[1px] text-text-3">
            {t("filters.to")}
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={FILTER_CLASS}
          />
        </label>
        <label className="flex min-w-[180px] flex-1 items-center gap-1.5">
          <span className="font-display text-[9.5px] font-bold uppercase tracking-[1px] text-text-3">
            {t("filters.query")}
          </span>
          <input
            type="text"
            value={qInput}
            placeholder={t("filters.search")}
            onChange={(e) => changeQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
            className={`${FILTER_CLASS} flex-1`}
          />
        </label>
        <button
          type="button"
          onClick={applySearch}
          aria-label={t("filters.action")}
          className="flex items-center gap-1.5 rounded-[2px] border-2 border-accent px-3 py-1 font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-accent transition hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Search size={13} strokeWidth={1.8} />
          {t("filters.action")}
        </button>
      </div>
      {loading && docs.length === 0 ? (
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
      {docs.length > 0 && docs.length < total && (
        <div className="flex justify-center border-t border-rule-soft/60 py-3">
          <button
            type="button"
            onClick={() => void load(docs.length, true)}
            disabled={loading}
            className="rounded-[2px] border-2 border-rule px-4 py-1.5 font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-rule transition hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            {t("filters.more")}
          </button>
        </div>
      )}
    </section>
  );
}
