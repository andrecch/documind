import { useTranslations } from "next-intl";

function FieldBox({
  label,
  serial,
  className,
  children,
}: {
  label: string;
  serial?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[3px] border-[1.5px] border-rule bg-sheet ${className ?? ""}`}>
      <div className="flex h-[26px] items-center gap-2 border-b border-rule bg-band px-3">
        <span className="font-display text-[10.5px] font-bold uppercase tracking-[1px] text-text-3">
          {label}
        </span>
        <span className="flex-1" />
        {serial && <span className="font-mono text-[11px] font-bold text-rule-soft">{serial}</span>}
      </div>
      <div className="px-3.5 py-2.5">{children}</div>
    </div>
  );
}

/** Campos 2–6 de la hoja en blanco, esperando la lectura (M1). */
export function RuledFields() {
  const t = useTranslations("upload.fields");
  const tc = useTranslations("upload");
  return (
    <div className="flex flex-col gap-[14px]">
      <FieldBox label={t("tipo")} serial="2">
        <div className="flex flex-wrap gap-2 pt-0.5">
          {["FACTURA", "CONTRATO", "RECIBO", "DOCUMENTACIÓN", "PROPUESTA"].map((lbl) => (
            <span
              key={lbl}
              className="rounded-[2px] border border-rule-soft px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.6px] text-text-3"
            >
              {lbl}
            </span>
          ))}
        </div>
      </FieldBox>
      <div className="flex gap-[18px]">
        <FieldBox label={t("fecha")} serial="3" className="w-72">
          <span className="font-mono text-[13px] text-rule-soft">{tc("datePlaceholder")}</span>
        </FieldBox>
        <FieldBox label={t("total")} serial="4" className="w-72">
          <span className="font-mono text-[13px] text-rule-soft">{tc("totalPlaceholder")}</span>
        </FieldBox>
        <FieldBox label={t("confianza")} serial="6" className="flex-1">
          <span className="font-mono text-[13px] text-rule-soft">{tc("confPlaceholder")}</span>
        </FieldBox>
      </div>
      <FieldBox label={t("emisor")} serial="5">
        <div className="flex flex-col gap-1.5 pt-0.5">
          <span className="font-mono text-[12.5px] text-rule-soft">{tc("emisorPlaceholder")}</span>
          <span className="font-mono text-[12.5px] text-rule-soft">{tc("receptorPlaceholder")}</span>
        </div>
      </FieldBox>
    </div>
  );
}
