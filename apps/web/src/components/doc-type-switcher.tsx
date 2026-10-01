"use client";
import { useTranslations } from "next-intl";
import type { DocumentType } from "@documind/shared";
import { DOCUMENT_TYPES } from "@documind/shared";

export function DocTypeSwitcher({
  value,
  disabled,
  onChange,
}: {
  value: DocumentType;
  disabled?: boolean;
  onChange: (type: DocumentType) => void;
}) {
  const t = useTranslations("review");
  return (
    <label className="flex items-center justify-between gap-3 border-b border-rule-soft/60 pb-2">
      <span className="font-display text-[10px] font-bold uppercase tracking-[1px] text-text-3">
        {t("type")}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as DocumentType)}
        className="rounded-[2px] border-2 border-accent bg-sheet px-2 py-1 font-mono text-[12px] font-bold uppercase tracking-[1.2px] text-accent outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        {DOCUMENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`types.${type}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
