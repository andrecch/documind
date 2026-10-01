import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SAMPLE_EXTRACTION } from "@documind/shared";
import type { AppPool } from "../src/database/drizzle";
import { POOL } from "../src/database/database.module";
import { AppModule } from "../src/app.module";
import { ExtractionService } from "../src/extractions/extraction.service";
import { OpenRouterProvider } from "../src/extractions/provider";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const PDF_1P = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKQlQgL0YxIDI0IFRmIDcyIDcwMCBUZCAoRG9jdU1pbmQgZml4dHVyZSkgVGogRVQKZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMwNCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjM3NAolJUVPRgo=",
  "base64",
);

async function truncate(pool: AppPool) {
  await pool.query(
    "TRUNCATE document_chunks, extraction_revisions, extractions, documents CASCADE",
  );
}

type HttpApp = Parameters<typeof request>[0];

async function uploadPdf(server: HttpApp) {
  return request(server).post("/api/v1/documents").attach("file", PDF_1P, "muestra.pdf");
}

let app: INestApplication;
let pool: AppPool;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  pool = app.get(POOL);
  await truncate(pool);
});

afterAll(async () => {
  await truncate(pool);
  await app.close();
});

describe("pipeline OCR (FakeProvider)", () => {
  it("sube un PDF, extrae y expone la ficha con revisión created", async () => {
    const upload = await uploadPdf(app.getHttpServer());
    expect(upload.status).toBe(201);

    const extract = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/extract`)
      .send();
    expect(extract.status).toBe(201);
    expect(extract.body.docType).toBe("factura");
    expect(extract.body.confidence).toBe(SAMPLE_EXTRACTION.confianza);
    expect(extract.body.llmData.numero).toBe(SAMPLE_EXTRACTION.numero);
    expect(extract.body.llmData.items).toHaveLength(2);
    expect(extract.body.tokens).toEqual({ prompt: 64, completion: 128 });
    expect(extract.body.extractionId).toBeTruthy();

    const detail = await request(app.getHttpServer()).get(
      `/api/v1/documents/${upload.body.id}/extraction`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.status).toBe("draft");
    expect(detail.body.docType).toBe("factura");
    expect(detail.body.extraction.emisor.nombre).toBe(SAMPLE_EXTRACTION.emisor?.nombre);
    expect(detail.body.fieldAudit).toBeNull();

    const doc = await request(app.getHttpServer()).get(`/api/v1/documents?status=ready_for_review`);
    expect(doc.body.items.some((d: { id: string }) => d.id === upload.body.id)).toBe(true);

    const revisions = await pool.query(
      "SELECT action, actor FROM extraction_revisions WHERE extraction_id = $1",
      [extract.body.extractionId],
    );
    expect(revisions.rows).toEqual([{ action: "created", actor: "llm" }]);

    const pages = await pool.query("SELECT page_count FROM documents WHERE id = $1", [
      upload.body.id,
    ]);
    expect(pages.rows[0]?.page_count).toBe(1);
  });

  it("sube un PNG y también extrae (1 imagen directa, sin render)", async () => {
    const upload = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .field("filename", "muestra.png")
      .attach("file", PNG_1PX, "muestra.png");
    const extract = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/extract`)
      .send();
    expect(extract.status).toBe(201);
    expect(extract.body.tokens.prompt).toBe(64);
  });

  it("re-extract reemplaza la extracción anterior (delete + insert)", async () => {
    const upload = await uploadPdf(app.getHttpServer());
    const first = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/extract`)
      .send();
    const second = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/extract`)
      .send();
    expect(second.status).toBe(201);
    expect(second.body.extractionId).not.toBe(first.body.extractionId);

    const counts = await pool.query(
      `SELECT
        (SELECT count(*) FROM extractions WHERE document_id = $1) AS extractions,
        (SELECT count(*) FROM extraction_revisions r
          JOIN extractions e ON e.id = r.extraction_id WHERE e.document_id = $1) AS revisions`,
      [upload.body.id],
    );
    expect(Number(counts.rows[0]?.extractions)).toBe(1);
    expect(Number(counts.rows[0]?.revisions)).toBe(1);
  });

  it("devuelve 409 mientras otra extracción sostiene el semáforo", async () => {
    const upload = await uploadPdf(app.getHttpServer());
    const service = app.get(ExtractionService);
    expect(service.semaphore.tryAcquire()).toBe(true);

    const busy = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/extract`)
      .send();
    expect(busy.status).toBe(409);
    expect(busy.body.code).toBe("EXTRACTION_IN_PROGRESS");

    const doc = await pool.query("SELECT status FROM documents WHERE id = $1", [upload.body.id]);
    expect(doc.rows[0]?.status).toBe("pending");

    service.semaphore.release();
    const ok = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/extract`)
      .send();
    expect(ok.status).toBe(201);
  });

  it("404 con error uniforme para documento sin extracción o inexistente", async () => {
    const upload = await uploadPdf(app.getHttpServer());
    const missing = await request(app.getHttpServer()).get(
      `/api/v1/documents/${upload.body.id}/extraction`,
    );
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("EXTRACTION_NOT_FOUND");

    const ghost = await request(app.getHttpServer())
      .post(`/api/v1/documents/${randomUUID()}/extract`)
      .send();
    expect(ghost.status).toBe(404);
    expect(ghost.body.code).toBe("DOCUMENT_NOT_FOUND");
  });
});

describe("backoff del OpenRouterProvider", () => {
  it("reintenta ante 429 y resuelve con tokens de usage", async () => {
    let hits = 0;
    const server = createServer((req, res) => {
      hits += 1;
      if (hits < 3) {
        res.writeHead(429, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "rate limited" } }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          model: "qwen/qwen3.8-27b:free",
          choices: [{ message: { content: JSON.stringify(SAMPLE_EXTRACTION) } }],
          usage: { prompt_tokens: 120, completion_tokens: 340 },
        }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      const provider = new OpenRouterProvider({
        apiKey: "test-key",
        visionModel: "vision-model",
        embeddingModel: "embed-model",
        chatModel: "chat-model",
        baseUrl: `http://127.0.0.1:${port}/api/v1`,
        maxAttempts: 5,
        initialBackoffMs: 5,
        timeoutMs: 5000,
      });
      const result = await provider.extractStructured(
        { images: [{ imageBase64: "aGk=", mimeType: "image/png" }] },
        {},
      );
      expect(hits).toBe(3);
      expect((result.raw as { doc_type?: string }).doc_type).toBe("factura");
      expect(result.modelId).toBe("qwen/qwen3.8-27b:free");
      expect(result.tokens).toEqual({ prompt: 120, completion: 340 });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
