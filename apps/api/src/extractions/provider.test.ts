import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@documind/shared";
import { FakeProvider } from "./provider";

function requestWithContext(fragment: string): ChatMessage[] {
  return [
    { role: "system", content: "Eres DocuMind." },
    {
      role: "user",
      content: `Pregunta: total\n<contexto>\n[1] ${fragment} (a.pdf)\n[2] Otro fragmento (b.png)\n</contexto>`,
    },
  ];
}

async function collectChunks(messages: ChatMessage[]) {
  const provider = new FakeProvider();
  const chunks: { contentDelta: string; reasoningDelta?: string }[] = [];
  for await (const chunk of provider.chatStream(messages)) chunks.push({ ...chunk });
  return chunks;
}

describe("FakeProvider.chatStream", () => {
  it("concatenado determinista con cita [1] cuando hay contexto", async () => {
    const chunks = await collectChunks(requestWithContext("Factura total 2.915.500"));
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.every((chunk) => chunk.reasoningDelta === undefined)).toBe(true);
    expect(chunks.map((chunk) => chunk.contentDelta).join("")).toBe(
      "Según tus documentos: Factura total 2.915.500 (a.pdf) [1].",
    );
  });

  it("recorta el fragmento a 160 caracteres", async () => {
    const long = "x".repeat(500);
    const chunks = await collectChunks(requestWithContext(long));
    const answer = chunks.map((chunk) => chunk.contentDelta).join("");
    expect(answer).toBe(`Según tus documentos: ${"x".repeat(160)} [1].`);
  });

  it("sin contexto responde que no lo encuentra", async () => {
    const chunks = await collectChunks([{ role: "user", content: "Pregunta suelta" }]);
    expect(chunks.map((chunk) => chunk.contentDelta).join("")).toBe(
      "No lo encuentro en tus documentos.",
    );
  });
});
