"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { DocumentType, SearchHit, SearchResponse } from "@documind/shared";
import { DOCUMENT_TYPES } from "@documind/shared";
import { Navbar } from "@/components/navbar";
import { SearchResults } from "@/components/search-results";
import { api } from "@/lib/api";
import { errorText } from "@/lib/error-text";
import { useActiveDoc } from "@/lib/store";

export default function SearchPage() {
  const t = useTranslations("search");
  const te = useTranslations("errors");
  const tt = useTranslations("review");
  const locale = useLocale();
  const router = useRouter();
  const set = useActiveDoc((s) => s.set);

  const [query, setQuery] = useState("");
  const [docType, setDocType] = useState<DocumentType | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (event: FormEvent) => {
    event.preventDefault();
    if (searching) return;
    setSearching(true);
    setError(null);
    try {
      setResults(
        await api.searchDocs({
          query,
          docType: docType === "" ? undefined : docType,
          from: from === "" ? undefined : new Date(from),
          to: to === "" ? undefined : new Date(to),
          limit: 6,
        }),
      );
    } catch (caught) {
      setResults(null);
      setError(errorText(te, caught instanceof Error ? caught.message : undefined));
    } finally {
      setSearching(false);
    }
  };

  const open = async (hit: SearchHit) => {
    const doc = await api.getDocument(hit.documentId);
    if (!doc) {
      setError(te("DOCUMENT_NOT_FOUND"));
      return;
    }
    set({ docId: doc.id, name: doc.filename, mime: doc.mime, size: doc.sizeBytes });
    router.push(`/${locale}/review`);
  };

  const filterClass =
    "min-w-0 rounded-[3px] border border-rule-soft bg-transparent px-2 py-1 font-mono text-[11px] text-text outline-none transition focus:border-rule";

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg">
      <Navbar />
      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col px-4 pb-12 pt-7">
        <section className="overflow-hidden rounded-[3px] border-[1.5px] border-rule bg-sheet">
          <div className="flex h-[30px] items-center gap-2 border-b border-rule bg-band px-3.5">
            <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-rule">
              {t("title")}
            </span>
          </div>
          <form onSubmit={run} className="flex flex-col gap-3 px-4 py-4">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("placeholder")}
                className={filterClass + " flex-1 py-2 text-[12.5px]"}
              />
              <button
                type="submit"
                disabled={searching || query.trim().length < 2}
                className="flex h-9 shrink-0 items-center gap-2 rounded-[3px] border border-accent bg-accent-soft px-3 font-display text-[11px] font-bold uppercase tracking-[1.2px] text-accent transition hover:bg-accent hover:text-sheet disabled:opacity-50"
              >
                <Search size={14} strokeWidth={1.8} />
                {t("action")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1.5">
                <span className="font-display text-[9.5px] font-bold uppercase tracking-[1px] text-text-3">
                  {t("filters.type")}
                </span>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocumentType | "")}
                  className={filterClass}
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
                  {t("filters.from")}
                </span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={filterClass}
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
                  className={filterClass}
                />
              </label>
            </div>
          </form>
        </section>

        {searching ? (
          <p className="mt-6 px-1 font-mono text-[11px] tracking-[1.2px] text-text-2">
            {t("searching")}
          </p>
        ) : error ? (
          <p role="alert" className="mt-6 px-1 font-mono text-[11.5px] font-bold text-accent">
            {error}
          </p>
        ) : results ? (
          <section className="mt-6 w-full overflow-hidden rounded-[3px] border-[1.5px] border-rule bg-sheet">
            <div className="flex h-[30px] items-center gap-2 border-b border-rule bg-band px-3.5">
              <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-rule">
                {t("results", { count: results.items.length, took: results.tookMs })}
              </span>
            </div>
            {results.items.length === 0 ? (
              <p className="px-4 py-4 font-mono text-[11.5px] text-text-2">{t("empty")}</p>
            ) : (
              <SearchResults items={results.items} query={query} onOpen={open} />
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
