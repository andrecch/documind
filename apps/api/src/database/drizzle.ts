import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DrizzleDB = ReturnType<typeof createDrizzle>;
export type AppPool = Pool;

export function createDrizzle(pool: Pool) {
  return drizzle(pool, { schema });
}

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 5 });
}

export * as dbSchema from "./schema";
