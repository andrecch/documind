"use client";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { FileRejection } from "react-dropzone";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, validateFile } from "@documind/shared";
import { useActiveDoc } from "@/lib/store";

const MAX_MB = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));

const ACCEPT = Object.fromEntries(ACCEPTED_MIME_TYPES.map((m) => [m, []]));

/** Campo 1 del talonario: la hoja espera su original. */
export function UploadDropzone() {
  const t = useTranslations("upload");
  const locale = useLocale();
  const router = useRouter();
  const set = useActiveDoc((s) => s.set);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (files: File[], rejections: FileRejection[]) => {
      setError(null);
      const file = files[0];
      if (file) {
        const result = validateFile(file);
        if (!result.ok) {
          setError(result.error === "file-too-large" ? t("tooLarge", { maxMb: MAX_MB }) : t("unsupported"));
          return;
        }
        set({ name: file.name, mime: file.type, size: file.size, objectUrl: URL.createObjectURL(file) });
        router.push(`/${locale}/review`);
        return;
      }
      const rejection = rejections[0];
      if (!rejection) return;
      const codes = rejection.errors.map((e) => e.code);
      setError(codes.includes("file-too-large") ? t("tooLarge", { maxMb: MAX_MB }) : t("unsupported"));
    },
    [set, router, locale, t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: false,
    noClick: false,
  });

  return (
    <div
      {...getRootProps()}
      className="w-full cursor-pointer rounded-[3px] border-[1.5px] border-rule bg-sheet outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <input {...getInputProps()} aria-label={t("browse")} />
      <div className="flex h-[30px] items-center border-b border-rule bg-band px-3.5">
        <span className="font-display text-[11.5px] font-bold uppercase tracking-[1.4px] text-rule">
          {t("field1")}
        </span>
      </div>
      <div
        className={`m-[10px] flex h-[300px] flex-col items-center justify-center gap-3 border-[1.5px] border-dashed transition ${
          isDragActive ? "border-accent bg-accent-soft" : "border-rule/50"
        }`}
      >
        <Upload size={34} strokeWidth={1.6} className="text-accent" />
        <p className="font-mono text-[13.5px] font-bold tracking-[1.2px] text-text">{t("dropTitle")}</p>
        <p className="font-mono text-[13px] text-text-2">{t("browse")}</p>
        <div className="mt-1 flex gap-2">
          {["JPG", "PNG", "WEBP", "PDF"].map((f) => (
            <span
              key={f}
              className="rounded-[2px] border border-rule-soft px-2.5 py-[3px] font-mono text-[9.5px] text-rule"
            >
              {f}
            </span>
          ))}
        </div>
        {error && (
          <p role="alert" className="font-mono text-[12px] font-bold text-accent">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
