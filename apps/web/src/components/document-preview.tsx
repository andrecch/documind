"use client";
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
  if (error) return <div className="text-text-3">PDF no renderizable</div>;
  return <canvas ref={canvasRef} className="max-h-full max-w-full rounded-lg bg-white" />;
}

export function DocumentPreview({ doc }: { doc: ActiveDoc }) {
  return (
    <section className="flex h-full min-w-0 flex-1 items-center justify-center bg-[#0F0A18] p-6">
      {doc.mime === "application/pdf" ? (
        <PdfPreview url={doc.objectUrl} page={1} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={doc.objectUrl} alt={doc.name} className="max-h-full max-w-full rounded-lg" />
      )}
    </section>
  );
}
