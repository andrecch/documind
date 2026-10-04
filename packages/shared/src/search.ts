import { z } from "zod";
import { documentTypeSchema } from "./file-validation";

export const searchRequestSchema = z.object({
  query: z.string().trim().min(2).max(500),
  docType: documentTypeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(6),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;

export type SearchHitKind = "document" | "item";

export type SearchHit = {
  chunkId: string;
  documentId: string;
  extractionId: string;
  filename: string;
  docType: z.infer<typeof documentTypeSchema>;
  kind: SearchHitKind;
  itemIndex: number | null;
  content: string;
  similarity: number | null;
  createdAt: string;
};

export type SearchResponse = {
  items: SearchHit[];
  tookMs: number;
};
