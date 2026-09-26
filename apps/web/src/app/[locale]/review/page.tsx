"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { SAMPLE_EXTRACTION } from "@documind/shared";
import { DocumentPreview } from "@/components/document-preview";
import { ExtractionSheet } from "@/components/extraction-sheet";
import { Navbar } from "@/components/navbar";
import { useActiveDoc } from "@/lib/store";

export default function ReviewPage() {
  const doc = useActiveDoc((s) => s.doc);
  const clear = useActiveDoc((s) => s.clear);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("review");

  useEffect(() => {
    if (!doc) router.replace(`/${locale}`);
  }, [doc, router, locale]);

  if (!doc) return null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg">
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
        <ExtractionSheet value={SAMPLE_EXTRACTION} docName={doc.name} />
      </div>
    </main>
  );
}
