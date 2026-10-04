import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { ApiEnv } from "../src/config/env";
import { API_ENV } from "../src/config/config.module";
import type { AppPool } from "../src/database/drizzle";
import { POOL } from "../src/database/database.module";
import { AppModule } from "../src/app.module";

function testingEnvWith(overrides: Partial<ApiEnv>): ApiEnv {
  const parsed = {
    DATABASE_URL:
      process.env.DATABASE_URL ?? "postgres://documind:documind@localhost:5433/documind",
    PORT: 4000,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    DOCUMIND_FAKE_PROVIDERS: process.env.DOCUMIND_FAKE_PROVIDERS,
    DOCUMIND_MASTER_KEY: process.env.DOCUMIND_MASTER_KEY,
    UPLOAD_DIR: process.env.UPLOAD_DIR ?? "uploads",
  };
  return { ...parsed, ...overrides } as ApiEnv;
}

async function buildAppWithEnv(overrides: Partial<ApiEnv>): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(API_ENV)
    .useValue(testingEnvWith(overrides))
    .compile();
  const detached = moduleRef.createNestApplication();
  detached.setGlobalPrefix("api/v1");
  detached.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await detached.init();
  return detached;
}

async function truncate(pool: AppPool) {
  await pool.query(
    "TRUNCATE document_chunks, extraction_revisions, extractions, documents, chat_messages, provider_settings, model_config CASCADE",
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
  await pool.query(
    "INSERT INTO model_config (provider, purpose, model_id, dimensions, is_default) VALUES" +
      " ('openrouter','vision','qwen/qwen3.8-27b:free',NULL,true)," +
      " ('openrouter','embedding','nvidia/nemotron-3-embed-1b:free',2048,true)," +
      " ('openrouter','chat','qwen/qwen3.8-27b:free',NULL,true)" +
      " ON CONFLICT DO NOTHING",
  );
});

afterAll(async () => {
  await truncate(pool);
  await app.close();
});

describe("settings (key cifrada + modelos)", () => {
  it("PUT/GET provider: guarda cifrado y devuelve solo el hint", async () => {
    const before = await request(app.getHttpServer()).get("/api/v1/settings/provider");
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ hint: null });

    const put = await request(app.getHttpServer())
      .put("/api/v1/settings/provider")
      .send({ apiKey: "sk-or-v1-e2e-test-key-0123456789ab" });
    expect(put.status).toBe(200);
    expect(put.body.hint).toBe("••••89ab");

    const after = await request(app.getHttpServer()).get("/api/v1/settings/provider");
    expect(after.body.hint).toBe("••••89ab");
    expect(JSON.stringify(after.body)).not.toContain("sk-or-v1");

    const stored = await pool.query(
      "SELECT api_key_cipher, api_key_hint FROM provider_settings LIMIT 1",
    );
    expect(stored.rows[0].api_key_cipher).not.toContain("sk-or-v1");
    expect(JSON.stringify(stored.rows[0])).not.toContain("sk-or-v1");
  });

  it("sin master key no se puede guardar: 400 MASTER_KEY_MISSING", async () => {
    const detached = await buildAppWithEnv({ DOCUMIND_MASTER_KEY: undefined });
    try {
      const put = await request(detached.getHttpServer())
        .put("/api/v1/settings/provider")
        .send({ apiKey: "sk-or-v1-sin-master-key-0123456789" });
      expect(put.status).toBe(400);
      expect(put.body.code).toBe("MASTER_KEY_MISSING");
    } finally {
      await detached.close();
    }
  });

  it("master no hex → 400 MASTER_KEY_INVALID al guardar", async () => {
    const detached = await buildAppWithEnv({ DOCUMIND_MASTER_KEY: "no-hex" });
    try {
      const put = await request(detached.getHttpServer())
        .put("/api/v1/settings/provider")
        .send({ apiKey: "sk-or-v1-master-mala-0123456789" });
      expect(put.status).toBe(400);
      expect(put.body.code).toBe("MASTER_KEY_INVALID");
    } finally {
      await detached.close();
    }
  });

  it("PUT/GET models: cambia el chat por defecto y health lo refleja", async () => {
    const seed = await request(app.getHttpServer()).get("/api/v1/settings/models?purpose=chat");
    expect(seed.status).toBe(200);
    expect(seed.body.current.modelId).toBe("qwen/qwen3.8-27b:free");
    expect(seed.body.available).toBeTypeOf("object");

    const put = await request(app.getHttpServer())
      .put("/api/v1/settings/models")
      .send({ purpose: "chat", modelId: "fake-chat-alternativo" });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ modelId: "fake-chat-alternativo", dimensions: null });

    const health = await request(app.getHttpServer()).get("/api/v1/health");
    expect(health.body.models.chat.modelId).toBe("fake-chat-alternativo");

    const rowsAgain = await pool.query(
      "SELECT count(*)::int AS n FROM model_config WHERE provider='openrouter' AND purpose='chat'",
    );
    expect(rowsAgain.rows[0].n).toBe(1);

    await request(app.getHttpServer())
      .put("/api/v1/settings/models")
      .send({ purpose: "chat", modelId: "qwen/qwen3.8-27b:free" });
  });

  it("400 con purpose inválido en PUT models", async () => {
    const res = await request(app.getHttpServer())
      .put("/api/v1/settings/models")
      .send({ purpose: "radio", modelId: "x" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});
