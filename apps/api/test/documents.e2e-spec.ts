import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { AppPool } from "../src/database/drizzle";
import { POOL } from "../src/database/database.module";
import { AppModule } from "../src/app.module";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function truncate(pool: AppPool) {
  await pool.query(
    "TRUNCATE document_chunks, extraction_revisions, extractions, documents CASCADE",
  );
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

describe("documents endpoints", () => {
  it("sube un png válido y lo lista en el historial", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .field("filename", "muestra.png")
      .attach("file", PNG_1PX, "muestra.png");
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.filename).toBe("muestra.png");
    expect(res.body.mime).toBe("image/png");

    const list = await request(app.getHttpServer()).get("/api/v1/documents");
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
    expect(list.body.items.some((d: { id: string }) => d.id === res.body.id)).toBe(true);
  });

  it("rechaza contenido que no es imagen ni pdf aunque el nombre diga .png", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .attach("file", Buffer.from("esto es texto plano, no es imagen"), "falso.png");
    expect(res.status).toBe(415);
    expect(res.body.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("rechaza archivo vacío", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .attach("file", Buffer.alloc(0), "vacio.png");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("EMPTY_FILE");
  });

  it("sirve el archivo original con el mime correcto", async () => {
    const upload = await request(app.getHttpServer())
      .post("/api/v1/documents")
      .attach("file", PNG_1PX, `${randomUUID()}.png`);
    const res = await request(app.getHttpServer()).get(`/api/v1/documents/${upload.body.id}/file`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.body.length).toBe(PNG_1PX.length);
  });

  it("devuelve error uniforme para documento inexistente", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/documents/${randomUUID()}/file`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("DOCUMENT_NOT_FOUND");
    expect(res.body.message).toBeTruthy();
  });

  it("filtra por estado en el listado", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/documents?status=archivado");
    expect(res.status).toBe(200);
    expect(res.body.items.every((d: { status: string }) => d.status === "archivado")).toBe(true);
  });
});
