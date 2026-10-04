"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { MessageSquare, Search, Settings, Upload } from "lucide-react";

const LINKS = [
  { path: "", key: "upload", icon: Upload },
  { path: "search", key: "search", icon: Search },
  { path: "chat", key: "chat", icon: MessageSquare },
  { path: "settings", key: "settings", icon: Settings },
] as const;

export function NavLinks() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1.5" aria-label={t("brand")}>
      {LINKS.map(({ path, key, icon: Icon }) => {
        const href = path === "" ? `/${locale}` : `/${locale}/${path}`;
        const active = path === "" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 items-center gap-1.5 rounded-[3px] border px-2.5 transition ${
              active
                ? "border-accent text-accent"
                : "border-transparent text-text-2 hover:border-rule-soft hover:text-rule"
            }`}
          >
            <Icon size={14} strokeWidth={1.8} />
            <span className="hidden font-display text-[10.5px] font-bold uppercase tracking-[1.2px] sm:block">
              {t(key)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
