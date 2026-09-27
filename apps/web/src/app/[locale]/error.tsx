"use client";
import { useTranslations } from "next-intl";

export default function LocaleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="font-display text-[26px] font-bold text-text">{t("title")}</p>
      <p className="font-mono text-[12.5px] text-text-2">{t("body")}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-[3px] border-[1.5px] border-rule bg-sheet px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[1.2px] text-rule transition hover:bg-band"
      >
        {t("retry")}
      </button>
    </main>
  );
}
