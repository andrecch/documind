import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgres://documind:documind@localhost:5433/documind"),
  PORT: z.coerce.number().int().default(4000),
  OPENROUTER_API_KEY: z.string().optional(),
  DOCUMIND_FAKE_PROVIDERS: z.string().optional(),
  DOCUMIND_MASTER_KEY: z.string().optional(),
  UPLOAD_DIR: z.string().default("uploads"),
});

export type ApiEnv = z.infer<typeof envSchema>;

let loaded = false;

export function loadEnvFiles(): void {
  if (loaded) return;
  loaded = true;
  loadDotenv({ path: path.resolve(process.cwd(), ".env") });
  loadDotenv({ path: path.resolve(process.cwd(), "..", "..", ".env") });
}

export function loadEnv(): ApiEnv {
  loadEnvFiles();
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
  }
  return parsed.data;
}
