export const ERROR_CODES = [
  "NETWORK",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "EMPTY_FILE",
  "TOO_MANY_PAGES",
  "INVALID_PDF",
  "LLM_ERROR",
  "EXTRACTION_IN_PROGRESS",
  "VALIDATION_ERROR",
  "DOCUMENT_NOT_FOUND",
  "EXTRACTION_NOT_FOUND",
  "EXTRACTION_CONFIRMED",
  "SEARCH_EMBED_ERROR",
  "unknown",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function errorText(t: (key: ErrorCode) => string, code: string | undefined): string {
  const matched = ERROR_CODES.find((candidate) => candidate === code);
  return t(matched ?? "unknown");
}
