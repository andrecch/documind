"use client";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { FileRejection } from "react-dropzone";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, validateFile } from "@documind/shared";
import { useActiveDoc } from "@/lib/store";

const MAX_MB = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));

const ACCEPT = Object.fromEntries(ACCEPTED_MIME_TYPES.map((m) => [m, []]));

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
      className={`w-full max-w-[660px] cursor-pointer rounded-[18px] border px-8 py-14 text-center transition ${
        isDragActive ? "border-border-accent bg-accent-soft" : "border-border bg-glass"
      }`}
      style={{ boxShadow: "var(--glow)" }}
    >
      <input {...getInputProps()} aria-label={t("browse")} />
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#E37BEA,#7C5CFF)] text-2xl">
        ⬆
      </div>
      <p className="text-[16px] font-medium text-text">{t("dropTitle")}</p>
      <p className="mt-1.5 text-[14px] text-text-2">{t("browse")}</p>
      <div className="mt-5 flex items-center justify-center gap-2">
        {["JPG", "PNG", "WEBP", "PDF"].map((f) => (
          <span
            key={f}
            className="rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-text-2"
          >
            {f}
          </span>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-[13px] text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
