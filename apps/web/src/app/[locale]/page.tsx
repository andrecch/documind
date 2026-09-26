import { getTranslations, setRequestLocale } from "next-intl/server";
import { CarbonStrip } from "@/components/carbon-strip";
import { Navbar } from "@/components/navbar";
import { RuledFields } from "@/components/ruled-fields";
import { UploadDropzone } from "@/components/upload-dropzone";

type Props = { params: Promise<{ locale: string }> };

export default async function UploadPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg">
      <Navbar />
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-[18px] px-16 pb-8 pt-7">
        <header className="flex items-start justify-between">
          <div>
            <p className="font-display text-[30px] font-bold leading-[1.05] tracking-[-0.5px] text-text">
              DOCUMIND
            </p>
            <p className="mt-1.5 font-display text-[11.5px] font-semibold uppercase tracking-[1.2px] text-text-2">
              {t("upload.sheetTitle")}
            </p>
            <p className="font-display text-[11.5px] font-semibold uppercase tracking-[1.2px] text-text-2">
              {t("upload.sheetSub")}
            </p>
          </div>
          <div className="rounded-[3px] border-2 border-accent px-6 py-3">
            <span className="font-mono text-[13.5px] font-bold tracking-[1px] text-accent">
              {t("nav.serial")}
            </span>
          </div>
        </header>
        <UploadDropzone />
        <RuledFields />
        <p className="font-display text-[13.5px] text-text-2">{t("upload.caption")}</p>
      </div>
      <CarbonStrip />
    </main>
  );
}
