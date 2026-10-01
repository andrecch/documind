"use client";
import { useLocale, useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";

export function ItemsTotalAlert({
  mismatch,
}: {
  mismatch: { expected: number; declared: number } | null;
}) {
  const t = useTranslations("review");
  const locale = useLocale();
  if (!mismatch) return null;
  const fmt = (n: number) => new Intl.NumberFormat(locale).format(n);
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-[2px] border-[1.5px] border-[#D9A400] bg-[#FBF3D9] px-3 py-2 font-mono text-[11px] leading-[1.5] text-[#7A5C00]"
    >
      <TriangleAlert size={13} strokeWidth={2} className="mt-0.5 shrink-0" />
      {t("totalsMismatch", { expected: fmt(mismatch.expected), declared: fmt(mismatch.declared) })}
    </p>
  );
}
