"use client";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./theme-toggle";

export function Navbar({ left }: { left?: React.ReactNode }) {
  const t = useTranslations("nav");
  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-border px-7">
      <div className="flex items-center gap-3">
        {left}
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#E37BEA,#7C5CFF)]" />
        <span className="font-display text-[15px] font-semibold text-text">{t("brand")}</span>
        <span className="font-mono text-[10px] text-text-3">v0.1</span>
      </div>
      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <button
          type="button"
          aria-label={t("settings")}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-2"
        >
          ☰
        </button>
      </div>
    </header>
  );
}
