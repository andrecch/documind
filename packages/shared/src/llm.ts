export type ProviderModel = { id: string; label: string; free: boolean; contextLength?: number };
export type VisionInput = { imageBase64: string; mimeType: string } | { pdfBase64: string };

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
  listModels(
    purpose: "vision" | "embedding",
    opts?: { freeOnly?: boolean },
  ): Promise<ProviderModel[]>;
}
