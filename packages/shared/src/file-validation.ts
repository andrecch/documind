import { z } from "zod";
import { DOCUMENT_TYPES } from "./document-types";

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export type FileValidationError = "unsupported-type" | "file-too-large";

export function validateFile(file: {
  type: string;
  size: number;
}): { ok: true; error: null } | { ok: false; error: FileValidationError } {
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type))
    return { ok: false, error: "unsupported-type" };
  if (file.size > MAX_FILE_SIZE_BYTES) return { ok: false, error: "file-too-large" };
  return { ok: true, error: null };
}
