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

describe("PATCH /documents/:id/extraction (ficha editable)", () => {
  async function freshDraft(): Promise<{ docId: string; extraction: Record<string, unknown> }> {
    const upload = await uploadPdf(app.getHttpServer());
    const extract = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/extract`)
      .send();
    expect(extract.status).toBe(201);
    return { docId: upload.body.id, extraction: extract.body.llmData };
  }

  it("guarda la edición, recalcula field_audit y registra revisión draft_edit", async () => {
    const { docId, extraction } = await freshDraft();
    const edited = {
      ...extraction,
      numero: "FAC-EDITADA-001",
      items: [
        { ...(extraction.items as Record<string, unknown>[])[0], cantidad: 7 },
        { ...(extraction.items as Record<string, unknown>[])[1], cantidad: 12 },
      ],
    };
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${docId}/extraction`)
      .send({ data: edited });
    expect(res.status).toBe(200);
    expect(res.body.extraction.numero).toBe("FAC-EDITADA-001");
    expect(res.body.fieldAudit.numero).toEqual({
      llm: "FAC-2026-0847",
      human: "FAC-EDITADA-001",
    });
    expect(res.body.fieldAudit["items.0.cantidad"]).toEqual({ llm: 1, human: 7 });
    expect(res.body.fieldAudit["items.1.cantidad"]).toBeUndefined();

    const revisions = await pool.query(
      `SELECT r.action, r.actor FROM extraction_revisions r
        JOIN extractions e ON e.id = r.extraction_id WHERE e.document_id = $1 ORDER BY r.created_at`,
      [docId],
    );
    const actions = revisions.rows.map((r: { action: string }) => r.action);
    expect(actions.filter((a: string) => a === "created")).toHaveLength(1);
    expect(actions.filter((a: string) => a === "draft_edit")).toHaveLength(1);
    const draftEdit = revisions.rows.find((r: { action: string }) => r.action === "draft_edit") as {
      actor: string;
    };
    expect(draftEdit.actor).toBe("humano");
  });

  it("sin cambios reales no inserta revisión nueva", async () => {
    const { docId, extraction } = await freshDraft();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${docId}/extraction`)
      .send({ data: extraction });
    expect(res.status).toBe(200);
    const count = await pool.query(
      "SELECT count(*)::int AS n FROM extraction_revisions r JOIN extractions e ON e.id = r.extraction_id WHERE e.document_id = $1",
      [docId],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it("al cambiar a contrato limpia las claves de items fuera de schema", async () => {
    const { docId, extraction } = await freshDraft();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${docId}/extraction`)
      .send({
        data: {
          ...extraction,
          doc_type: "contrato",
          objeto: "Arrendamiento",
          partes: "A y B",
          valor: 36000000,
          items: [{ descripcion: "x", cantidad: 1, valor_unitario: 1, valor_total: 1 }],
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.docType).toBe("contrato");
    expect(res.body.extraction.items).toBeUndefined();
    expect(res.body.extraction.objeto).toBe("Arrendamiento");
  });

  it("409 si la extracción está confirmada", async () => {
    const { docId, extraction } = await freshDraft();
    await pool.query("UPDATE extractions SET status = 'confirmed' WHERE document_id = $1", [docId]);
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${docId}/extraction`)
      .send({ data: { ...extraction, numero: "X" } });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EXTRACTION_CONFIRMED");
  });

  it("400 si el payload no cumple el esquema", async () => {
    const { docId } = await freshDraft();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${docId}/extraction`)
      .send({ data: { doc_type: "factura" } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("404 sin extracción y 404 documento fantasma", async () => {
    const upload = await uploadPdf(app.getHttpServer());
    const noExtraction = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${upload.body.id}/extraction`)
      .send({ data: {} });
    expect(noExtraction.status).toBe(404);
    expect(noExtraction.body.code).toBe("EXTRACTION_NOT_FOUND");

    const ghost = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${randomUUID()}/extraction`)
      .send({ data: {} });
    expect(ghost.status).toBe(404);
    expect(ghost.body.code).toBe("DOCUMENT_NOT_FOUND");
  });
});

describe("gate confirmar + embeddings (Task 6)", () => {
  async function confirmedDoc(): Promise<{
    docId: string;
    extractionId: string;
    llmData: Record<string, unknown>;
  }> {
    const upload = await uploadPdf(app.getHttpServer());
    const extract = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/extract`)
      .send();
    const confirm = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/confirm`)
      .send();
    expect(confirm.status).toBe(200);
    return {
      docId: upload.body.id,
      extractionId: confirm.body.extractionId,
      llmData: extract.body.llmData,
    };
  }

  it("confirma: inserta padre+hijos, sella archivado y registra revisión confirmed", async () => {
    const { docId, extractionId } = await confirmedDoc();

    const chunks = await pool.query(
      "SELECT kind, item_index, content, vector_dims(embedding) AS dims FROM document_chunks WHERE document_id = $1 ORDER BY kind, item_index NULLS FIRST",
      [docId],
    );
    expect(chunks.rows).toHaveLength(3);
    expect(chunks.rows[0]).toMatchObject({ kind: "document", item_index: null, dims: 2048 });
    expect(chunks.rows[0].content).toContain("Factura FAC-2026-0847");
    expect(chunks.rows[1]).toMatchObject({ kind: "item", item_index: 0, dims: 2048 });
    expect(chunks.rows[1].content).toContain("Ítem 1 de factura");
    expect(chunks.rows[2]).toMatchObject({ kind: "item", item_index: 1, dims: 2048 });

    const state = await pool.query(
      `SELECT e.status, e.confirmed_at IS NOT NULL AS confirmed_now, e.confirmed_data IS NOT NULL AS has_confirmed,
              d.status AS doc_status
         FROM extractions e JOIN documents d ON d.id = e.document_id WHERE e.id = $1`,
      [extractionId],
    );
    expect(state.rows[0]).toMatchObject({
      status: "confirmed",
      confirmed_now: true,
      has_confirmed: true,
      doc_status: "archivado",
    });

    const revision = await pool.query(
      "SELECT action, actor FROM extraction_revisions WHERE extraction_id = $1 AND action = 'confirmed'",
      [extractionId],
    );
    expect(revision.rows).toEqual([{ action: "confirmed", actor: "humano" }]);

    const detail = await request(app.getHttpServer()).get(`/api/v1/documents/${docId}/extraction`);
    expect(detail.status).toBe(200);
    expect(detail.body.status).toBe("confirmed");
    expect(detail.body.extraction.numero).toBe("FAC-2026-0847");
  });

  it("re-confirmar devuelve 409 sin duplicar chunks", async () => {
    const { docId } = await confirmedDoc();
    const again = await request(app.getHttpServer())
      .post(`/api/v1/documents/${docId}/confirm`)
      .send();
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("EXTRACTION_CONFIRMED");
    const count = await pool.query(
      "SELECT count(*)::int AS n FROM document_chunks WHERE document_id = $1",
      [docId],
    );
    expect(count.rows[0].n).toBe(3);
  });

  it("PATCH confirmed regenera embeddings y registra post_confirm_edit", async () => {
    const { docId, llmData } = await confirmedDoc();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${docId}/extraction/confirmed`)
      .send({ data: { ...llmData, numero: "FAC-ARCHIVADA-01" } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.extraction.numero).toBe("FAC-ARCHIVADA-01");
    expect(res.body.fieldAudit.numero).toEqual({
      llm: "FAC-2026-0847",
      human: "FAC-ARCHIVADA-01",
    });

    const chunks = await pool.query(
      "SELECT count(*)::int AS n, bool_and(content NOT LIKE '%FAC-2026-0847%') AS replaced FROM document_chunks WHERE document_id = $1",
      [docId],
    );
    expect(chunks.rows[0].n).toBe(3);
    expect(chunks.rows[0].replaced).toBe(true);

    const audit = await pool.query(
      `SELECT e.llm_data ->> 'numero' AS llm_numero, e.confirmed_data ->> 'numero' AS confirmed_numero
         FROM extractions e JOIN documents d ON d.id = e.document_id WHERE d.id = $1`,
      [docId],
    );
    expect(audit.rows[0]).toEqual({
      llm_numero: "FAC-2026-0847",
      confirmed_numero: "FAC-ARCHIVADA-01",
    });

    const revision = await pool.query(
      `SELECT count(*)::int AS n FROM extraction_revisions r
         JOIN extractions e ON e.id = r.extraction_id
        WHERE e.document_id = $1 AND r.action = 'post_confirm_edit' AND r.actor = 'humano'`,
      [docId],
    );
    expect(revision.rows[0].n).toBe(1);
  });

  it("PATCH confirmed sin cambios reales no re-embed ni revisa", async () => {
    const { docId, llmData } = await confirmedDoc();
    const before = await pool.query(
      "SELECT max(r.created_at) AS newest FROM extraction_revisions r JOIN extractions e ON e.id = r.extraction_id WHERE e.document_id = $1",
      [docId],
    );
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${docId}/extraction/confirmed`)
      .send({ data: llmData });
    expect(res.status).toBe(200);
    const after = await pool.query(
      "SELECT max(r.created_at) AS newest FROM extraction_revisions r JOIN extractions e ON e.id = r.extraction_id WHERE e.document_id = $1",
      [docId],
    );
    expect(String(after.rows[0].newest)).toBe(String(before.rows[0].newest));
  });

  it("409 si se intenta editar como archivado un borrador", async () => {
    const upload = await uploadPdf(app.getHttpServer());
    await request(app.getHttpServer()).post(`/api/v1/documents/${upload.body.id}/extract`).send();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${upload.body.id}/extraction/confirmed`)
      .send({ data: {} });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EXTRACTION_NOT_CONFIRMED");
  });

  it("404 al confirmar sin extracción y documento fantasma", async () => {
    const upload = await uploadPdf(app.getHttpServer());
    const noExtraction = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/confirm`)
      .send();
    expect(noExtraction.status).toBe(404);
    expect(noExtraction.body.code).toBe("EXTRACTION_NOT_FOUND");

    const ghost = await request(app.getHttpServer())
      .post(`/api/v1/documents/${randomUUID()}/confirm`)
      .send();
    expect(ghost.status).toBe(404);
    expect(ghost.body.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("tipo sin tabla de ítems solo inserta el chunk padre", async () => {
    const upload = await uploadPdf(app.getHttpServer());
    const extract = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/extract`)
      .send();
    await request(app.getHttpServer())
      .patch(`/api/v1/documents/${upload.body.id}/extraction`)
      .send({
        data: {
          ...extract.body.llmData,
          doc_type: "contrato",
          objeto: "Arrendamiento",
          partes: "A y B",
          items: undefined,
        },
      });
    const confirm = await request(app.getHttpServer())
      .post(`/api/v1/documents/${upload.body.id}/confirm`)
      .send();
    expect(confirm.status).toBe(200);
    expect(confirm.body.chunksInserted).toBe(1);
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
