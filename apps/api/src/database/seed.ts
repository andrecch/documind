import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDrizzle, createPool, dbSchema } from "./drizzle";

const url = process.env.DATABASE_URL ?? "postgres://documind:documind@localhost:5433/documind";

const SEED_MODELS = [
  { provider: "openrouter", purpose: "vision", modelId: "qwen/qwen3.8-27b:free", dimensions: null },
  {
    provider: "openrouter",
    purpose: "embedding",
    modelId: "nvidia/nemotron-3-embed-1b:free",
    dimensions: 2048,
  },
  { provider: "openrouter", purpose: "chat", modelId: "qwen/qwen3.8-27b:free", dimensions: null },
] as const;

async function main() {
  const pool = createPool(url);
  const db = createDrizzle(pool);
  try {
    for (const model of SEED_MODELS) {
      await db
        .insert(dbSchema.modelConfig)
        .values({ ...model, isDefault: true })
        .onConflictDoNothing();
    }
    const defaults = await db
      .select()
      .from(dbSchema.modelConfig)
      .where(eq(dbSchema.modelConfig.isDefault, true));
    console.log(
      "[db:seed] defaults:",
      defaults.map((m) => `${m.purpose}=${m.modelId}`).join(" · "),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[db:seed] failed", error);
  process.exit(1);
});
