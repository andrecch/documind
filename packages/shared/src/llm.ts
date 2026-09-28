export type ProviderModel = { id: string; label: string; free: boolean; contextLength?: number };
export type VisionInput = { imageBase64: string; mimeType: string } | { pdfBase64: string };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatStreamChunk = { contentDelta: string; reasoningDelta?: string };

export type ModelPurpose = "vision" | "embedding" | "chat";

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
