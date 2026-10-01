import type { ExtractionResult, LLMProvider } from "@documind/shared";
import { naturalTextsForExtraction } from "./natural-text";

export type ChunkDraft = {
  kind: "document" | "item";
  itemIndex: number | null;
  content: string;
  embedding: number[];
};

export async function buildChunkRows(
  provider: LLMProvider,
  data: ExtractionResult,
): Promise<ChunkDraft[]> {
  const texts = naturalTextsForExtraction(data);
  const inputs = [texts.document, ...texts.items.map((item) => item.content)];
  const vectors = await provider.embed(inputs);
  if (vectors.length !== inputs.length) {
    throw new Error(
      `El provider devolvió ${vectors.length} embeddings para ${inputs.length} textos`,
    );
  }
  const rows: ChunkDraft[] = [
    { kind: "document", itemIndex: null, content: texts.document, embedding: vectors[0]! },
  ];
  texts.items.forEach((item, position) => {
    rows.push({
      kind: "item",
      itemIndex: item.itemIndex,
      content: item.content,
      embedding: vectors[position + 1]!,
    });
  });
  return rows;
}
