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
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-16 text-center">
        <p className="rounded-full border border-border-accent bg-accent-soft px-3.5 py-1.5 font-mono text-[11px] font-medium tracking-[1.4px] text-text-2">
          {t("upload.badge")}
        </p>
        <h1 className="max-w-[720px] font-display text-4xl font-bold leading-[1.12] tracking-tight text-text md:text-[44px]">
          {t("upload.title")}
        </h1>
        <p className="max-w-[620px] text-[16px] leading-relaxed text-text-2">{t("upload.subtitle")}</p>
        <UploadDropzone />
        <p className="text-[12.5px] text-text-3">{t("upload.caption", { maxMb: 20 })}</p>
      </section>
    </main>
  );
}
