import { useTranslations } from "next-intl";

/** Fila inferior de la hoja: perforaciones + copia carbón (estado M0, sin extracción aún). */
export function CarbonStrip() {
  const t = useTranslations("carbon");
  return (
    <section className="px-16 pb-0">
      <div className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: 44 }).map((_, i) => (
          <span key={i} className="h-1 w-1 rounded-full bg-rule-soft" />
        ))}
      </div>
      <div className="flex items-center justify-between bg-carbon px-7 py-5">
        <div className="min-w-0">
          <p className="font-display text-[11px] font-bold uppercase tracking-[1.4px] text-carbon-key">
            {t("title")}
          </p>
          <p className="mt-1 truncate font-mono text-[12px] text-carbon-text">{t("sample")}</p>
        </div>
        <p className="ml-6 shrink-0 font-mono text-[10px] uppercase tracking-[1px] text-carbon-soft">
          {t("model")}
        </p>
      </div>
      <div className="flex items-center justify-between bg-carbon px-7 pb-4">
        <span className="font-mono text-[9.5px] uppercase tracking-[1.2px] text-carbon-soft">
          {t("hint")}
        </span>
        <span className="font-display text-[10px] font-bold uppercase tracking-[1.2px] text-[#F5E9EA]/40">
          VER COPIA COMPLETA →
        </span>
      </div>
    </section>
  );
}
