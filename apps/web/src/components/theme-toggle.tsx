"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("theme");
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" aria-hidden />;
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-label={t(dark ? "toLight" : "toDark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-2 transition hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
