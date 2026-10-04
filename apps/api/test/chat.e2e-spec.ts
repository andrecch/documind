import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { AddressInfo } from "node:net";
import type { ExtractionResult, SseEvent } from "@documind/shared";
import type { AppPool } from "../src/database/drizzle";
import { POOL } from "../src/database/database.module";
import { AppModule } from "../src/app.module";
import { naturalTextsForExtraction } from "../src/extractions/natural-text";

async function truncate(pool: AppPool) {
  await pool.query(
    "TRUNCATE document_chunks, extraction_revisions, extractions, documents, chat_messages CASCADE",
  );
}

const PDF_1P = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKQlQgL0YxIDI0IFRmIDcyIDcwMCBUZCAoRG9jdU1pbmQgZml4dHVyZSkgVGogRVQKZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDAwMzA0IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMzc0CiUlRU9GCg==",
  "base64",
);

function parseEvents(text: string): SseEvent[] {
  return text
    .split("\n\n")
    .filter((frame) => frame.startsWith("data: "))
    .map((frame) => JSON.parse(frame.slice(6)) as SseEvent);
}

let app: INestApplication;
let pool: AppPool;
let baseUrl: string;
let itemContent0: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.listen(0);
  const address = (app.getHttpServer().address() ?? 0) as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  pool = app.get(POOL);
  await truncate(pool);

  const upload = await request(app.getHttpServer())
    .post("/api/v1/documents")
    .attach("file", PDF_1P, "muestra.pdf");
  expect(upload.status).toBe(201);
  const extract = await request(app.getHttpServer())
    .post(`/api/v1/documents/${upload.body.id}/extract`)
    .send();
  expect(extract.status).toBe(201);
  itemContent0 = naturalTextsForExtraction(extract.body.llmData as ExtractionResult).items.map(
    (item) => item.content,
  )[0]!;
  const confirm = await request(app.getHttpServer())
    .post(`/api/v1/documents/${upload.body.id}/confirm`)
    .send();
  expect(confirm.status).toBe(200);
});

afterAll(async () => {
  await truncate(pool);
  await app.close();
});

describe("POST /chat (FakeProvider determinístico, SSE)", () => {
  it("primera pregunta grounded: emite deltas, citas del ítem y sessionId/messageId", async () => {
    const res = await fetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: itemContent0 }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await res.text();
    const events = parseEvents(text);

    const deltas = events.filter(
      (event): event is Extract<SseEvent, { type: "delta" }> => event.type === "delta",
    );
    expect(deltas.length).toBeGreaterThanOrEqual(2);
    expect(deltas.map((event) => event.text).join("")).toContain("Según tus documentos:");

    const citationsEvent = events.find(
      (event): event is Extract<SseEvent, { type: "citations" }> => event.type === "citations",
    );
    expect(citationsEvent).toBeDefined();
    expect(citationsEvent!.citations.length).toBeGreaterThanOrEqual(1);
    expect(citationsEvent!.citations[0]).toMatchObject({ chunkKind: "item", itemIndex: 0 });
    expect(citationsEvent!.citations[0]!.label).toContain("muestra.pdf");
    expect(citationsEvent!.sessionId).toMatch(/[0-9a-f-]{36}/);
    expect(citationsEvent!.messageId).toMatch(/[0-9a-f-]{36}/);

    const count = await pool.query("SELECT count(*)::int AS n FROM chat_messages");
    expect(count.rows[0].n).toBe(2);
  });

  it("segunda pregunta con la misma sesión persiste 4 filas y mantiene el historial", async () => {
    const first = await fetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: itemContent0 }),
    });
    const events = parseEvents(await first.text());
    const citationsEvent = events.find(
      (event): event is Extract<SseEvent, { type: "citations" }> => event.type === "citations",
    );
    const sessionId = citationsEvent!.sessionId;

    const second = await fetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "asdf qwerty pregunta rara", sessionId }),
    });
    expect(second.status).toBe(200);
    expect(second.headers.get("content-type")).toContain("text/event-stream");
    const secondEvents = parseEvents(await second.text());
    const secondCitations = secondEvents.find(
      (event): event is Extract<SseEvent, { type: "citations" }> => event.type === "citations",
    );
    expect(secondCitations!.sessionId).toBe(sessionId);
    expect(secondCitations!.citations.length).toBeGreaterThanOrEqual(1);

    const count = await pool.query(
      "SELECT count(*)::int AS n FROM chat_messages WHERE session_id = $1",
      [sessionId],
    );
    expect(count.rows[0].n).toBe(4);
  });

  it("sessionId propia del cliente se respeta y persiste", async () => {
    const sessionId = randomUUID();
    const res = await fetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: itemContent0, sessionId }),
    });
    const headers = await res.text();
    const events = parseEvents(headers);
    const citationsEvent = events.find(
      (event): event is Extract<SseEvent, { type: "citations" }> => event.type === "citations",
    );
    expect(citationsEvent!.sessionId).toBe(sessionId);
  });

  it("400 VALIDATION_ERROR con mensaje vacío (antes de abrir el stream)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });
    expect(res.status).toBe(400);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe("VALIDATION_ERROR");
  });
});
