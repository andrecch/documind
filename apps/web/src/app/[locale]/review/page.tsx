"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, ScanSearch } from "lucide-react";
import { DocumentPreview } from "@/components/document-preview";
import { FichaForm } from "@/components/ficha-form";
import { Navbar } from "@/components/navbar";
import { api, ApiError, type ExtractionDetail } from "@/lib/api";
import { errorText } from "@/lib/error-text";
import { useActiveDoc } from "@/lib/store";

export default function ReviewPage() {
  const doc = useActiveDoc((s) => s.doc);
  const clear = useActiveDoc((s) => s.clear);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("review");
  const te = useTranslations("errors");
  const [detail, setDetail] = useState<ExtractionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) router.replace(`/${locale}`);
  }, [doc, router, locale]);

  const docId = doc?.docId;

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    setLoading(true);
    api
      .getExtraction(docId)
      .then((found) => {
        if (!cancelled) setDetail(found);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const refreshDetail = useCallback(() => {
    if (!docId) return;
    void api
      .getExtraction(docId)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [docId]);

  const runExtract = useCallback(async () => {
    if (!doc) return;
    setExtracting(true);
    setExtractError(null);
    try {
      await api.extract(doc.docId);
      setDetail(await api.getExtraction(doc.docId));
    } catch (error) {
      setExtractError(errorText(te, error instanceof ApiError ? error.code : undefined));
    } finally {
      setExtracting(false);
    }
  }, [doc, te]);

  if (!doc) return null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg">
      <h1 className="sr-only">
        {doc.name} — {t("sheetTitle")}
      </h1>
      <Navbar
        left={
          <>
            <button
              type="button"
              aria-label={t("back")}
              onClick={() => {
                clear();
                router.push(`/${locale}`);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-rule-soft text-text-2 transition hover:border-rule hover:text-rule"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
            </button>
          </>
        }
      />
      <div className="flex h-[calc(100dvh-64px)] flex-col md:flex-row">
        <DocumentPreview doc={doc} />
        {loading ? (
          <div className="flex flex-1 items-center justify-center bg-bg p-6">
            <span className="font-mono text-[11px] tracking-[1.2px] text-text-2">
              {t("preparing")}
            </span>
          </div>
        ) : extracting ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-bg px-6">
            <div className="overflow-hidden rounded-[3px] border-[1.5px] border-rule bg-sheet px-8 py-6 text-center">
              <ScanSearch
                size={26}
                strokeWidth={1.6}
                className="mx-auto animate-pulse text-accent"
              />
              <p className="mt-3 font-display text-[12.5px] font-bold uppercase tracking-[1.2px] text-text">
                {t("extracting")}
              </p>
              <p className="mt-1 font-mono text-[11px] text-text-2">{t("extractingHint")}</p>
            </div>
          </div>
        ) : !detail || !detail.extraction ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg px-6">
            <div className="w-full max-w-[520px] overflow-hidden rounded-[3px] border-[1.5px] border-rule bg-sheet">
              <div className="flex h-[30px] items-center border-b border-rule bg-band px-3.5">
                <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-rule">
                  {t("extractTitle")}
                </span>
              </div>
              <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
                <p className="font-mono text-[12px] leading-[1.6] text-text-2">
                  {t("extractHint")}
                </p>
                <button
                  type="button"
                  onClick={() => void runExtract()}
                  className="rounded-[2px] border-2 border-accent px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[1.4px] text-accent transition hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {t("extract")}
                </button>
                {extractError && (
                  <p role="alert" className="font-mono text-[11.5px] font-bold text-accent">
                    {extractError}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <FichaForm
            key={`${detail.extractionId}:${detail.status}`}
            docId={doc.docId}
            docName={doc.name}
            initial={detail.extraction}
            readOnly={detail.status === "confirmed"}
            tokens={detail.tokens}
            fieldAudit={detail.fieldAudit}
            onConfirmed={refreshDetail}
          />
        )}
      </div>
    </main>
  );
}
