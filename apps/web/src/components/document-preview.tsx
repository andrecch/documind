"use client";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ActiveDoc } from "@/lib/store";

function PdfPreview({
  url,
  page,
  onPages,
}: {
  url: string;
  page: number;
  onPages: (n: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const pagesRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    let pdf: import("pdfjs-dist").PDFDocumentProxy | null = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      try {
        pdf = await pdfjs.getDocument(url).promise;
        if (!cancelled && !pagesRef.current) {
          pagesRef.current = true;
          onPages(pdf.numPages);
        }
        const pageDoc = await pdf.getPage(page);
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
      pdf?.destroy?.();
    };
  }, [url, page, onPages]);
  if (error) return <div className="font-mono text-[12px] text-text-3">PDF no renderizable</div>;
  return <canvas ref={canvasRef} className="max-h-full max-w-[420px] bg-white shadow-sm" />;
}

/** Mitad izquierda (comp V2): el original sobre la mesa, con sello LEÍDO y paginador real. */
export function DocumentPreview({ doc }: { doc: ActiveDoc }) {
  const t = useTranslations("review");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-band/60">
      <div className="flex h-10 items-center justify-between px-6">
        <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-text-3">
          {t("original")}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] text-text-2">
            {t("page", { page, total: pages })}
          </span>
          <button
            type="button"
            aria-label={t("page", { page: page - 1, total: pages })}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-6 w-6 items-center justify-center rounded-[2px] border border-rule-soft text-text-2 transition enabled:hover:border-rule enabled:hover:text-rule disabled:opacity-40"
          >
            <ChevronLeft size={12} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label={t("page", { page: page + 1, total: pages })}
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="flex h-6 w-6 items-center justify-center rounded-[2px] border border-rule-soft text-text-2 transition enabled:hover:border-rule enabled:hover:text-rule disabled:opacity-40"
          >
            <ChevronRight size={12} strokeWidth={2} />
          </button>
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center px-8 pb-6">
        <div className="relative">
          {doc.mime === "application/pdf" ? (
            <PdfPreview url={doc.objectUrl} page={page} onPages={setPages} />
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
