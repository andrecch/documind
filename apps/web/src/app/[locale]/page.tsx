import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Navbar } from "@/components/navbar";
import { SheetIllustration } from "@/components/sheet-illustration";
import { UploadDropzone } from "@/components/upload-dropzone";

type Props = { params: Promise<{ locale: string }> };

export default async function UploadPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg">
      <Navbar />
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-5 pb-12 pt-7 md:px-16">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-[30px] font-bold leading-[1.05] tracking-[-0.5px] text-text">
              DOCUMIND
            </h1>
            <p className="mt-2 max-w-[560px] font-display text-[14px] leading-[1.6] text-text-2">
              {t("upload.tagline")}
            </p>
          </div>
          <SheetIllustration className="hidden h-[100px] shrink-0 md:block" />
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
