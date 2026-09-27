"use client";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Focus, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ActiveDoc } from "@/lib/store";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

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
  const [ready, setReady] = useState(false);
  const tLoading = useTranslations("review");
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
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      pdf?.destroy?.();
    };
  }, [url, page, onPages]);
  if (error) return <div className="p-8 text-center font-mono text-[12px] text-accent">PDF no renderizable</div>;
  return (
    <div className="relative">
      <canvas ref={canvasRef} className="h-auto w-full bg-white" />
      {!ready && (
        <span className="absolute inset-0 flex items-center justify-center bg-band/80 px-4 text-center font-mono text-[11px] tracking-[1.2px] text-text-2">
          {tLoading("preparing")}
        </span>
      )}
    </div>
  );
}

/** Mitad izquierda (comp V2): visor del original — fit al panel, zoom ±25% y pan. */
export function DocumentPreview({ doc }: { doc: ActiveDoc }) {
  const t = useTranslations("review");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [imgReady, setImgReady] = useState(false);

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100));

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-band/60">
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border px-6">
        <span className="font-display text-[10.5px] font-bold uppercase tracking-[1.4px] text-text-3">
          {t("original")}
        </span>
        <span className="rounded-[2px] border-2 border-accent px-2 py-0.5 font-mono text-[10px] font-bold tracking-[1.2px] text-accent">
          {t("read")}
        </span>
        <span className="flex-1" />
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-7 w-7 items-center justify-center rounded-[2px] border border-rule-soft text-text-2 transition enabled:hover:border-rule enabled:hover:text-rule disabled:opacity-40"
          >
            <ZoomOut size={13} strokeWidth={2} />
          </button>
          <span className="w-12 text-center font-mono text-[10.5px] text-text-2">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-7 w-7 items-center justify-center rounded-[2px] border border-rule-soft text-text-2 transition enabled:hover:border-rule enabled:hover:text-rule disabled:opacity-40"
          >
            <ZoomIn size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            className="ml-1 flex h-7 items-center gap-1 rounded-[2px] border border-rule-soft px-2 font-display text-[9.5px] font-bold uppercase tracking-[1px] text-text-2 transition enabled:hover:border-rule enabled:hover:text-rule disabled:opacity-40"
          >
            <Focus size={11} strokeWidth={2} />
            Ajustar
          </button>
        </span>
        <span className="mx-2 h-4 w-px bg-border" aria-hidden />
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={t("page", { page: page - 1, total: pages })}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-6 w-6 items-center justify-center rounded-[2px] border border-rule-soft text-text-2 transition enabled:hover:border-rule enabled:hover:text-rule disabled:opacity-40"
          >
            <ChevronLeft size={12} strokeWidth={2} />
          </button>
          <span className="font-mono text-[10.5px] text-text-2">
            {t("page", { page, total: pages })}
          </span>
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
      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="flex min-w-full justify-center py-4"
          style={{ width: `${zoom * 100}%` }}
        >
          <div className="w-full px-4">
            {doc.mime === "application/pdf" ? (
              <PdfPreview url={doc.objectUrl} page={page} onPages={setPages} />
            ) : (
              <div className="relative mx-auto max-w-[900px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {imgError ? (
                  <div className="flex min-h-32 items-center justify-center border border-dashed border-rule-soft bg-sheet/80 font-mono text-[11px] tracking-[1.2px] text-accent">
                    {t("empty")}
                  </div>
                ) : (
                  <>
                    <img
                      src={doc.objectUrl}
                      alt={doc.name}
                      onLoad={() => setImgReady(true)}
                      onError={() => setImgError(true)}
                      className={`w-full border-[1.5px] border-rule bg-white ${imgReady && !imgError ? "" : "opacity-0"}`}
                    />
                    {!imgReady && !imgError && (
                      <span className="absolute inset-0 flex min-h-24 items-center justify-center border border-dashed border-rule-soft bg-sheet/80 font-mono text-[11px] tracking-[1.2px] text-text-2">
                        {t("preparing")}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
