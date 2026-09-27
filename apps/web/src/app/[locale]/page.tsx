import { getTranslations, setRequestLocale } from "next-intl/server";
import { Navbar } from "@/components/navbar";
import { UploadDropzone } from "@/components/upload-dropzone";

type Props = { params: Promise<{ locale: string }> };

export default async function UploadPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg">
      <Navbar />
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-5 pb-12 pt-7 md:px-16">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-[30px] font-bold leading-[1.05] tracking-[-0.5px] text-text">
              DOCUMIND
            </h1>
            <p className="mt-1.5 font-display text-[11.5px] font-semibold uppercase tracking-[1.2px] text-text-2">
              {t("upload.sheetTitle")}
            </p>
            <p className="font-display text-[11.5px] font-semibold uppercase tracking-[1.2px] text-text-2">
              {t("upload.sheetSub")}
            </p>
          </div>
          <div className="hidden shrink-0 rounded-[3px] border-2 border-accent px-6 py-3 sm:block">
            <span className="font-mono text-[13.5px] font-bold tracking-[1px] text-accent">
              {t("nav.serial")}
            </span>
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center py-12">
          <div className="w-full">
            <UploadDropzone />
          </div>
          <p className="mt-6 max-w-[720px] text-center font-display text-[13.5px] text-text-2">
            {t("upload.caption")}
          </p>
        </div>
      </div>
    </main>
  );
}
