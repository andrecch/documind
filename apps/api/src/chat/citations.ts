import type { Citation, SearchHit } from "@documind/shared";

export function buildContext(hits: SearchHit[]): string {
  return hits
    .map((hit, index) => {
      const source =
        hit.kind === "item" ? `${hit.filename} · ítem ${(hit.itemIndex ?? 0) + 1}` : hit.filename;
      return `[${index + 1}] ${hit.content} (${source})`;
    })
    .join("\n");
}

export function extractCitations(answer: string, context: SearchHit[]): Citation[] {
  const indexes = new Set<number>();
  for (const match of answer.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= context.length) indexes.add(n - 1);
  }
  const picked = indexes.size > 0 ? context.filter((_, i) => indexes.has(i)) : context;
  return picked.map((hit) => ({
    documentId: hit.documentId,
    extractionId: hit.extractionId,
    chunkKind: hit.kind,
    itemIndex: hit.kind === "item" ? (hit.itemIndex ?? null) : undefined,
    label:
      hit.kind === "item" ? `${hit.filename} · ítem ${(hit.itemIndex ?? 0) + 1}` : hit.filename,
  }));
}
