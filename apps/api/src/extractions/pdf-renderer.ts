import type { Pdf } from "pdf-to-img";

export const MAX_OCR_PAGES = 8;

export class TooManyPagesError extends Error {
  constructor(readonly pages: number) {
    super(`El documento tiene ${pages} páginas y el límite por extracción es ${MAX_OCR_PAGES}`);
    this.name = "TooManyPagesError";
  }
}

export class PdfRenderError extends Error {
  constructor(message = "No se pudo procesar el PDF", options?: { cause: unknown }) {
    super(message, options);
    this.name = "PdfRenderError";
  }
}

export async function renderPdf(buffer: Buffer): Promise<Buffer[]> {
  const { pdf } = await import("pdf-to-img");
  let doc: Pdf;
  try {
    doc = await pdf(buffer, { scale: 2 });
  } catch (error) {
    throw new PdfRenderError(undefined, { cause: error });
  }
  try {
    if (doc.length > MAX_OCR_PAGES) throw new TooManyPagesError(doc.length);
    const pages: Buffer[] = [];
    for await (const image of doc) pages.push(image);
    return pages;
  } finally {
    await doc.destroy();
  }
}
