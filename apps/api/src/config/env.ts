import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgres://documind:documind@localhost:5433/documind"),
  PORT: z.coerce.number().int().default(4000),
  OPENROUTER_API_KEY: z.string().optional(),
  DOCUMIND_FAKE_PROVIDERS: z.string().optional(),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function loadEnv(): ApiEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
  }
  return parsed.data;
}
