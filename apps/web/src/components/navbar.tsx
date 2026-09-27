"use client";
import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function Navbar({ left }: { left?: React.ReactNode }) {
  const t = useTranslations("nav");
  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-border bg-sheet px-7">
      <div className="flex items-center gap-3">
        {left}
        <div className="flex h-6 w-6 items-center justify-center bg-accent" aria-hidden />
        <span className="font-display text-[22px] font-bold leading-none tracking-[-0.5px] text-text">
          {t("brand")}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <button
          type="button"
          aria-label={t("settings")}
          className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-rule-soft text-text-2 transition hover:border-rule hover:text-rule"
        >
          <Settings size={16} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
