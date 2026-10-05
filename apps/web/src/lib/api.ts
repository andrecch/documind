import type {
  ChatRequest,
  Citation,
  DocumentStatus,
  DocumentType,
  ExtractionResult,
  FieldAudit,
  ModelPurpose,
  ProviderModel,
  SseEvent,
  SearchRequest,
  SearchResponse,
} from "@documind/shared";
import { readSse } from "@/lib/sse";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type DocumentSummary = {
  id: string;
  filename: string;
  status: DocumentStatus;
  mime: string;
  sizeBytes: number;
  pageCount: number | null;
  createdAt: string;
};

export type ExtractResponse = {
  extractionId: string;
  docType: DocumentType;
  confidence: number;
  llmData: ExtractionResult;
  tokens: { prompt: number; completion: number };
};

export type ExtractionDetail = {
  extractionId: string;
  documentId: string;
  status: "draft" | "confirmed";
  docType: DocumentType;
  confidence: number;
  extraction: ExtractionResult | null;
  fieldAudit: FieldAudit | null;
  tokens: { prompt: number; completion: number };
  createdAt: string;
  updatedAt: string;
};

export type ConfirmResponse = {
  extractionId: string;
  status: "confirmed";
  chunksInserted: number;
};

export type ModelsResponse = {
  current: { modelId: string; dimensions: number | null } | null;
  available: ProviderModel[];
};

const BASE = "/api";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError("NETWORK", "", 0);
  }
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const record = payload as { code?: string; message?: string; details?: unknown };
    throw new ApiError(
      record.code ?? `HTTP_${response.status}`,
      record.message ?? "",
      response.status,
      record.details,
    );
  }
  return payload as T;
}

export const api = {
  uploadDocument(file: File): Promise<DocumentSummary> {
    const form = new FormData();
    form.append("file", file);
    return call<DocumentSummary>("/documents", { method: "POST", body: form });
  },

  listDocuments(
    params: {
      status?: DocumentStatus;
      docType?: DocumentType;
      q?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ items: DocumentSummary[]; total: number }> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.docType) query.set("docType", params.docType);
    if (params.q) query.set("q", params.q);
    if (params.from) query.set("createdFrom", params.from);
    if (params.to) query.set("createdTo", params.to);
    if (params.limit != null) query.set("limit", String(params.limit));
    if (params.offset != null) query.set("offset", String(params.offset));
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return call<{ items: DocumentSummary[]; total: number }>(`/documents${suffix}`);
  },

  extract(documentId: string): Promise<ExtractResponse> {
    return call<ExtractResponse>(`/documents/${documentId}/extract`, { method: "POST" });
  },

  async getExtraction(documentId: string): Promise<ExtractionDetail | null> {
    try {
      return await call<ExtractionDetail>(`/documents/${documentId}/extraction`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "EXTRACTION_NOT_FOUND") return null;
      throw error;
    }
  },

  patchExtraction(documentId: string, data: ExtractionResult): Promise<ExtractionDetail> {
    return call<ExtractionDetail>(`/documents/${documentId}/extraction`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
  },

  confirmDocument(documentId: string): Promise<ConfirmResponse> {
    return call<ConfirmResponse>(`/documents/${documentId}/confirm`, { method: "POST" });
  },

  fileUrl(documentId: string): string {
    return `${BASE}/documents/${documentId}/file`;
  },

  getProvider(): Promise<{ hint: string | null }> {
    return call<{ hint: string | null }>("/settings/provider");
  },

  saveProvider(apiKey: string): Promise<{ hint: string }> {
    return call<{ hint: string }>("/settings/provider", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
  },

  getModels(purpose: ModelPurpose): Promise<ModelsResponse> {
    return call<ModelsResponse>(`/settings/models?purpose=${purpose}&free=true`);
  },

  saveModel(params: {
    purpose: ModelPurpose;
    modelId: string;
    dimensions?: number | null;
  }): Promise<{
    modelId: string;
    dimensions: number | null;
  }> {
    return call<{ modelId: string; dimensions: number | null }>("/settings/models", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  },

  getDocument(documentId: string): Promise<DocumentSummary | null> {
    return call<DocumentSummary>(`/documents/${documentId}`).catch((error) => {
      if (error instanceof ApiError && error.code === "DOCUMENT_NOT_FOUND") return null;
      throw error;
    });
  },

  searchDocs(params: SearchRequest): Promise<SearchResponse> {
    return call<SearchResponse>("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        docType: params.docType,
        from: params.from?.toISOString(),
        to: params.to?.toISOString(),
        limit: params.limit,
      }),
    });
  },

  async chat(
    params: ChatRequest,
    onDelta: (text: string) => void,
  ): Promise<{ sessionId: string; messageId: string; citations: Citation[] }> {
    const request: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    };
    let response: Response;
    try {
      response = await fetch(`${BASE}/chat`, request);
    } catch {
      throw new ApiError("NETWORK", "", 0);
    }
    if (!response.ok) {
      const text = await response.text();
      let payload: { code?: string; message?: string } = {};
      try {
        payload = JSON.parse(text) as { code?: string; message?: string };
      } catch {
        payload = {};
      }
      throw new ApiError(
        payload.code ?? `HTTP_${response.status}`,
        payload.message ?? "",
        response.status,
      );
    }

    let streamError: { code: string; message: string } | null = null;
    let answer: { sessionId: string; messageId: string; citations: Citation[] } | null = null;
    return new Promise((resolve, reject) => {
      void readSse<SseEvent>(
        response,
        (event) => {
          if (event.type === "delta") {
            onDelta(event.text);
            return;
          }
          if (event.type === "citations") {
            answer = {
              sessionId: event.sessionId,
              messageId: event.messageId,
              citations: event.citations,
            };
            return;
          }
          streamError = { code: event.code, message: event.message };
        },
        (status) => {
          const failed = streamError as { code: string; message: string } | null;
          if (failed) {
            reject(new ApiError(failed.code, failed.message, status));
            return;
          }
          if (answer) {
            resolve(answer as { sessionId: string; messageId: string; citations: Citation[] });
            return;
          }
          reject(new ApiError("unknown", "", status));
        },
      );
    });
  },
};
