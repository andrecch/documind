"use client";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./theme-toggle";
import { NavLinks } from "./nav-links";

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
        <NavLinks />
        <ThemeToggle />
      </div>
    </header>
  );
}
