"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SAMPLE_EXTRACTION } from "@documind/shared";
import { DocumentPreview } from "@/components/document-preview";
import { JsonPanel } from "@/components/json-panel";
import { Navbar } from "@/components/navbar";
import { ThemeToggle } from "@/components/theme-toggle";
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-2"
            >
              ←
            </button>
            <span className="text-[14px] font-medium text-text">{doc.name}</span>
            <span className="flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-[12px] text-[color:var(--success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />
              {t("status")}
            </span>
          </>
        }
      />
      <div className="flex h-[calc(100dvh-64px)] flex-col md:flex-row">
        <div className="h-full flex-1">
          <DocumentPreview doc={doc} />
        </div>
        <div className="h-full flex-1">
          <JsonPanel value={SAMPLE_EXTRACTION} />
        </div>
      </div>
    </main>
  );
}
