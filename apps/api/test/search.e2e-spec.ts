import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { ExtractionResult } from "@documind/shared";
import type { AppPool } from "../src/database/drizzle";
import { POOL } from "../src/database/database.module";
import { AppModule } from "../src/app.module";
import { naturalTextsForExtraction } from "../src/extractions/natural-text";

async function truncate(pool: AppPool) {
  await pool.query(
    "TRUNCATE document_chunks, extraction_revisions, extractions, documents CASCADE",
  );
}

type HttpApp = Parameters<typeof request>[0];

async function uploadPdf(server: HttpApp) {
  return request(server).post("/api/v1/documents").attach("file", PDF_1P, "muestra.pdf");
}

const PDF_1P = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKQlQgL0YxIDI0IFRmIDcyIDcwMCBUZCAoRG9jdU1pbmQgZml4dHVyZSkgVGogRVQKZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDAwMzA0IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMzc0CiUlRU9GCg==",
  "base64",
);

let app: INestApplication;
let pool: AppPool;
let docId: string;
let itemContents: string[];

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  pool = app.get(POOL);
  await truncate(pool);

  const upload = await uploadPdf(app.getHttpServer());
  expect(upload.status).toBe(201);
  docId = upload.body.id;
  const extract = await request(app.getHttpServer())
    .post(`/api/v1/documents/${docId}/extract`)
    .send();
  expect(extract.status).toBe(201);
  const confirm = await request(app.getHttpServer())
    .post(`/api/v1/documents/${docId}/confirm`)
    .send();
  expect(confirm.status).toBe(200);
  expect(confirm.body.chunksInserted).toBe(3);

  itemContents = naturalTextsForExtraction(extract.body.llmData as ExtractionResult).items.map(
    (item) => item.content,
  );
  expect(itemContents).toHaveLength(2);
});

afterAll(async () => {
  await truncate(pool);
  await app.close();
});

describe("POST /search (FakeProvider determinístico)", () => {
  it("la consulta exacta del chunk hijo lo devuelve arriba y su padre acompaña", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/search")
      .send({ query: itemContents[0] });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    const [item, parent] = res.body.items;
    expect(item).toMatchObject({
      kind: "item",
      itemIndex: 0,
      docType: "factura",
      filename: "muestra.pdf",
      documentId: docId,
    });
    expect(Math.abs(item.similarity - 1)).toBeLessThan(1e-6);
    expect(parent).toMatchObject({ kind: "document", itemIndex: null, similarity: null });
    expect(parent.documentId).toBe(docId);
    expect(res.body.tookMs).toBeLessThan(1000);
  });

  it("GET /documents/:id responde la ficha para el deep-link de citas", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/documents/${docId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: docId, status: "archivado", filename: "muestra.pdf" });
    const ghost = await request(app.getHttpServer()).get(`/api/v1/documents/${randomUUID()}`);
    expect(ghost.status).toBe(404);
    expect(ghost.body.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("query libre devuelve resultados con similarity en (-1,1] y descendente", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/search")
      .send({ query: "instalación eléctrica" });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    let previous = Infinity;
    for (const hit of res.body.items) {
      expect(hit.similarity === null || (hit.similarity <= 1 && hit.similarity > -1)).toBe(true);
      if (hit.similarity !== null) {
        expect(hit.similarity).toBeLessThanOrEqual(previous);
        previous = hit.similarity;
      }
    }
    const first = res.body.items[0];
    expect(first.content.length).toBeGreaterThan(0);
    expect(new Date(first.createdAt).toISOString()).toBe(first.createdAt);
  });

  it("filtro docType=contrato descarta la factura", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/search")
      .send({ query: itemContents[0], docType: "contrato" });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("filtro from en el futuro no devuelve nada", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/search")
      .send({ query: itemContents[0], from: "2030-01-01T00:00:00Z" });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("el top-k del limit se recorta antes del dedup, pero el padre siempre acompaña", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/search")
      .send({ query: itemContents[0], limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].kind).toBe("item");
    expect(res.body.items[0].similarity).toBeGreaterThan(0.99);
    expect(res.body.items[1].kind).toBe("document");
  });

  it("400 con query de un carácter", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/search").send({ query: "a" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});
