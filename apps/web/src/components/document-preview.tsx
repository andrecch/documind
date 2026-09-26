"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { ActiveDoc } from "@/lib/store";

function PdfPreview({ url, page }: { url: string; page: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      try {
        const doc = await pdfjs.getDocument(url).promise;
        const pageDoc = await doc.getPage(page);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const viewport = pageDoc.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await pageDoc.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, page]);
  if (error) return <div className="font-mono text-[12px] text-text-3">PDF no renderizable</div>;
  return <canvas ref={canvasRef} className="max-h-full max-w-[420px] bg-white shadow-sm" />;
}

/** Mitad izquierda (comp V2): el original sobre la mesa, con sello LEÍDO. */
export function DocumentPreview({ doc }: { doc: ActiveDoc }) {
  const t = useTranslations("review");
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-band/60">
      <div className="flex h-10 items-center justify-between px-6">
        <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-text-3">
          {t("original")}
        </span>
        <span className="font-mono text-[10.5px] text-text-2">{t("page", { page: 1, total: 2 })}</span>
      </div>
      <div className="flex flex-1 items-center justify-center px-8 pb-6">
        <div className="relative">
          {doc.mime === "application/pdf" ? (
            <PdfPreview url={doc.objectUrl} page={1} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc.objectUrl}
              alt={doc.name}
              className="max-h-[72vh] max-w-[560px] border-[1.5px] border-rule bg-white"
            />
          )}
          <span className="absolute bottom-3 left-3 rounded-[3px] border-2 border-accent bg-sheet/90 px-3 py-1.5 font-mono text-[11px] font-bold tracking-[1.4px] text-accent">
            {t("read")}
          </span>
        </div>
      </div>
    </section>
  );
}
