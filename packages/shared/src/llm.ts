export type ProviderModel = { id: string; label: string; free: boolean; contextLength?: number };
export type VisionImage = { imageBase64: string; mimeType: string };
export type VisionInput = { images: VisionImage[] };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatStreamChunk = { contentDelta: string; reasoningDelta?: string };

export const MODEL_PURPOSES = ["vision", "embedding", "chat"] as const;
export type ModelPurpose = (typeof MODEL_PURPOSES)[number];

export interface LLMProvider {
  readonly id: string;
  extractStructured(
    input: VisionInput,
    jsonSchema: object,
  ): Promise<{
    raw: unknown;
    modelId: string;
    tokens: { prompt: number; completion: number };
  }>;
  embed(inputs: string[]): Promise<number[][]>;
  chatStream(messages: ChatMessage[]): AsyncGenerator<ChatStreamChunk>;
  listModels(purpose: ModelPurpose, opts?: { freeOnly?: boolean }): Promise<ProviderModel[]>;
}
