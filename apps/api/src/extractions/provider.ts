import {
  SAMPLE_EXTRACTION,
  type ChatMessage,
  type ChatStreamChunk,
  type LLMProvider,
  type ModelPurpose,
  type ProviderModel,
  type VisionInput,
} from "@documind/shared";
import { API_ENV } from "../config/config.module";
import type { ApiEnv } from "../config/env";
import { SettingsService } from "../settings/settings.service";
import { buildCorrectionPrompt, buildExtractionSystemPrompt } from "./llm-schema";

export const PROVIDER = "PROVIDER";
export const EMBEDDING_DIMS = 2048;

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const RETRYABLE_STATUSES = new Set([408, 429]);

export class LlmProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "LlmProviderError";
  }
}

export type OpenRouterConfig = {
  apiKey: string;
  visionModel: string;
  embeddingModel: string;
  chatModel: string;
  baseUrl?: string;
  maxAttempts?: number;
  initialBackoffMs?: number;
  timeoutMs?: number;
};

type TokenUse = { prompt: number; completion: number };
type ChatResponse = {
  model?: string;
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};
type EmbeddingsResponse = { data?: { embedding: number[] }[]; error?: { message?: string } };
type ModelsResponse = {
  data?: {
    id?: string;
    name?: string;
    architecture?: { modality?: string; input_modalities?: string[] };
    pricing?: { prompt?: string; completion?: string };
  }[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number): boolean {
  return RETRYABLE_STATUSES.has(status) || status >= 500;
}

function stripFences(text: string): string {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text.trim());
  return match?.[1] ?? text;
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(stripFences(text)) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function addTokens(a: TokenUse, b: TokenUse): TokenUse {
  return { prompt: a.prompt + b.prompt, completion: a.completion + b.completion };
}

type OrMessage = {
  role: "system" | "user" | "assistant";
  content: string | { type: string; image_url?: { url: string } }[];
};

export class OpenRouterProvider implements LLMProvider {
  readonly id = "openrouter";
  private readonly baseUrl: string;
  private readonly maxAttempts: number;
  private readonly initialBackoffMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly config: OpenRouterConfig) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.maxAttempts = config.maxAttempts ?? 5;
    this.initialBackoffMs = config.initialBackoffMs ?? 500;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async extractStructured(
    input: VisionInput,
    jsonSchema: object,
  ): Promise<{ raw: unknown; modelId: string; tokens: TokenUse }> {
    const messages: OrMessage[] = [
      { role: "system", content: buildExtractionSystemPrompt() },
      {
        role: "user",
        content: input.images.map((image) => ({
          type: "image_url",
          image_url: { url: `data:${image.mimeType};base64,${image.imageBase64}` },
        })),
      },
    ];

    const request = {
      model: this.config.visionModel,
      messages,
      response_format: { type: "json_schema", json_schema: jsonSchema },
      usage: { include: true },
    };

    const first = await this.chatOnce(request);
    const parsed = tryParseJson(first.text);
    if (parsed.ok) {
      return { raw: parsed.value, modelId: first.model, tokens: first.tokens };
    }

    messages.push({ role: "assistant", content: first.text });
    messages.push({
      role: "user",
      content: buildCorrectionPrompt(first.text, parsed.error),
    });
    const second = await this.chatOnce(request);
    const reparsed = tryParseJson(second.text);
    if (!reparsed.ok) {
      throw new LlmProviderError(
        "LLM_INVALID_JSON",
        "El LLM devolvió JSON inválido dos veces",
        undefined,
        reparsed.error,
      );
    }
    return {
      raw: reparsed.value,
      modelId: second.model,
      tokens: addTokens(first.tokens, second.tokens),
    };
  }

  async embed(inputs: string[]): Promise<number[][]> {
    if (inputs.length === 0) return [];
    const res = await this.post<EmbeddingsResponse>("/embeddings", {
      model: this.config.embeddingModel,
      input: inputs,
    });
    const rows = res.data ?? [];
    if (rows.length !== inputs.length) {
      throw new LlmProviderError(
        "LLM_BAD_EMBEDDING",
        `OpenRouter devolvió ${rows.length} embeddings para ${inputs.length} entradas`,
      );
    }
    return rows.map((row) => row.embedding);
  }

  async *chatStream(messages: ChatMessage[]): AsyncGenerator<ChatStreamChunk> {
    const headers = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "DocuMind",
    };
    let response: Response | undefined;
    let lastStatus = 0;
    let lastDetail: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      if (attempt > 1) await sleep(this.backoffMs(attempt));
      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({ model: this.config.chatModel, messages, stream: true }),
        });
      } catch (error) {
        lastStatus = 0;
        lastDetail = error instanceof Error ? `${error.name}: ${error.message}` : error;
        continue;
      }
      if (response.ok) break;
      lastStatus = response.status;
      lastDetail = (await response.text().catch(() => "")).slice(0, 500);
      if (!isRetryable(response.status)) {
        throw new LlmProviderError(
          "LLM_HTTP_ERROR",
          `OpenRouter respondió ${response.status}`,
          response.status,
          lastDetail,
        );
      }
      response = undefined;
    }
    if (!response || !response.ok) {
      throw new LlmProviderError(
        "LLM_UNAVAILABLE",
        `OpenRouter no disponible tras ${this.maxAttempts} intentos (chat)`,
        lastStatus || undefined,
        lastDetail,
      );
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      let lineBreak: number;
      while ((lineBreak = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, lineBreak).replace(/\r$/, "");
        buffer = buffer.slice(lineBreak + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const event = JSON.parse(payload) as {
            choices?: { delta?: { content?: string; reasoning?: string } }[];
          };
          const delta = event.choices?.[0]?.delta;
          if (!delta) continue;
          const chunk: ChatStreamChunk = { contentDelta: delta.content ?? "" };
          if (typeof delta.reasoning === "string" && delta.reasoning.length > 0) {
            chunk.reasoningDelta = delta.reasoning;
          }
          yield chunk;
        } catch {
          continue;
        }
      }
    }
  }

  async listModels(purpose: ModelPurpose, opts?: { freeOnly?: boolean }): Promise<ProviderModel[]> {
    const res = await this.post<ModelsResponse>("/models", undefined, "GET");
    const models: ProviderModel[] = [];
    for (const row of res.data ?? []) {
      if (!row.id) continue;
      const modalities = row.architecture?.input_modalities ?? [];
      const modality = row.architecture?.modality ?? "";
      const haystack = `${modality} ${modalities.join(" ")}`.toLowerCase();
      const matches =
        purpose === "vision"
          ? haystack.includes("image")
          : purpose === "embedding"
            ? haystack.includes("embedding")
            : haystack.includes("text");
      if (!matches) continue;
      const free =
        row.id.endsWith(":free") ||
        (row.pricing?.prompt === "0" && row.pricing?.completion === "0");
      if (opts?.freeOnly && !free) continue;
      models.push({ id: row.id, label: row.name ?? row.id, free });
    }
    return models;
  }

  private async chatOnce(
    body: unknown,
  ): Promise<{ text: string; model: string; tokens: TokenUse }> {
    const res = await this.post<ChatResponse>("/chat/completions", body);
    const text = res.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new LlmProviderError("LLM_EMPTY_RESPONSE", "El LLM no devolvió contenido");
    }
    return {
      text,
      model: res.model ?? this.config.visionModel,
      tokens: {
        prompt: res.usage?.prompt_tokens ?? 0,
        completion: res.usage?.completion_tokens ?? 0,
      },
    };
  }

  private async post<T>(
    path: string,
    payload: unknown,
    method: "POST" | "GET" = "POST",
  ): Promise<T> {
    let lastStatus = 0;
    let lastDetail: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      if (attempt > 1) await sleep(this.backoffMs(attempt));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "DocuMind",
          },
          body: method === "GET" ? undefined : JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (error) {
        lastStatus = 0;
        lastDetail = error instanceof Error ? `${error.name}: ${error.message}` : error;
        continue;
      } finally {
        clearTimeout(timer);
      }
      const rawText = await response.text();
      let json: T & { error?: { message?: string } };
      try {
        json = (rawText ? JSON.parse(rawText) : {}) as T & { error?: { message?: string } };
      } catch {
        json = { error: { message: rawText.slice(0, 500) } } as T & {
          error?: { message?: string };
        };
      }
      if (response.ok) return json;
      lastStatus = response.status;
      lastDetail = json?.error?.message ?? json;
      if (!isRetryable(response.status)) {
        throw new LlmProviderError(
          "LLM_HTTP_ERROR",
          `OpenRouter respondió ${response.status}`,
          response.status,
          lastDetail,
        );
      }
    }
    throw new LlmProviderError(
      "LLM_UNAVAILABLE",
      `OpenRouter no disponible tras ${this.maxAttempts} intentos`,
      lastStatus || undefined,
      lastDetail,
    );
  }

  private backoffMs(attempt: number): number {
    const base = this.initialBackoffMs * 2 ** (attempt - 2);
    return Math.round(base * (0.5 + Math.random()));
  }
}

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deterministicVector(text: string, dims = EMBEDDING_DIMS): number[] {
  const rand = mulberry32(fnv1a(text));
  const values = Array.from({ length: dims }, () => rand() * 2 - 1);
  const norm = Math.sqrt(values.reduce((acc, x) => acc + x * x, 0));
  return values.map((x) => x / norm);
}

export class FakeProvider implements LLMProvider {
  readonly id = "fake";

  async extractStructured(input: VisionInput): Promise<{
    raw: unknown;
    modelId: string;
    tokens: { prompt: number; completion: number };
  }> {
    return {
      raw: structuredClone(SAMPLE_EXTRACTION),
      modelId: "fake-vision",
      tokens: { prompt: input.images.length * 64, completion: 128 },
    };
  }

  async embed(inputs: string[]): Promise<number[][]> {
    return inputs.map((text) => deterministicVector(text));
  }

  async *chatStream(messages: ChatMessage[]): AsyncGenerator<ChatStreamChunk> {
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    const contextoBlock =
      /<contexto>\n([\s\S]*?)<\/contexto>/.exec(lastUser?.content ?? "")?.[1] ?? "";
    const fragment = /^\[1\] ([^\n]*)/m.exec(contextoBlock)?.[1] ?? "";
    const answer = fragment
      ? `Según tus documentos: ${fragment.slice(0, 160)} [1].`
      : "No lo encuentro en tus documentos.";
    const pieces = splitDeltas(answer, 3);
    for (const piece of pieces) yield { contentDelta: piece };
  }

  async listModels(purpose: ModelPurpose): Promise<ProviderModel[]> {
    return [{ id: `fake-${purpose}`, label: `Fake ${purpose}`, free: true }];
  }
}

function splitDeltas(text: string, count: number): string[] {
  const size = Math.ceil(text.length / count);
  const pieces: string[] = [];
  for (let offset = 0; offset < text.length; offset += size) {
    pieces.push(text.slice(offset, offset + size));
  }
  return pieces;
}

export const providerFactory = {
  provide: PROVIDER,
  useFactory: async (env: ApiEnv, settings: SettingsService): Promise<LLMProvider> => {
    if (env.DOCUMIND_FAKE_PROVIDERS === "1") return new FakeProvider();
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY es obligatorio si DOCUMIND_FAKE_PROVIDERS no está a 1");
    }
    const models = await settings.getDefaultModels();
    if (!models.vision || !models.embedding || !models.chat) {
      throw new Error("Faltan semillas de model_config para vision/embedding/chat");
    }
    return new OpenRouterProvider({
      apiKey: env.OPENROUTER_API_KEY,
      visionModel: models.vision.modelId,
      embeddingModel: models.embedding.modelId,
      chatModel: models.chat.modelId,
    });
  },
  inject: [API_ENV, SettingsService],
};
