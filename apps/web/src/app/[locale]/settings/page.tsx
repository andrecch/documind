"use client";
import { useTranslations } from "next-intl";
import { Navbar } from "@/components/navbar";
import { SettingsForm } from "@/components/settings-form";

export default function SettingsPage() {
  const t = useTranslations("settings");
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg">
      <Navbar />
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pb-12 pt-7">
        <section className="overflow-hidden rounded-[3px] border-[1.5px] border-rule bg-sheet">
          <div className="flex h-[30px] items-center gap-2 border-b border-rule bg-band px-3.5">
            <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-rule">
              {t("title")}
            </span>
          </div>
          <SettingsForm />
        </section>
      </div>
    </main>
  );
}
