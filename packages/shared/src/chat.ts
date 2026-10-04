import { z } from "zod";

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type CitationChunkKind = "document" | "item";

export const citationSchema = z.object({
  documentId: z.string().uuid(),
  extractionId: z.string().uuid(),
  chunkKind: z.enum(["document", "item"]),
  itemIndex: z.number().int().nullable().optional(),
  label: z.string(),
});
export type Citation = z.infer<typeof citationSchema>;

export type SseEvent =
  | { type: "delta"; text: string }
  | {
      type: "citations";
      citations: Citation[];
      messageId: string;
      sessionId: string;
    }
  | { type: "error"; code: string; message: string };
