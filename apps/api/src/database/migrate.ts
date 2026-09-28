import "dotenv/config";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDrizzle, createPool } from "./drizzle";

const url = process.env.DATABASE_URL ?? "postgres://documind:documind@localhost:5433/documind";

async function main() {
  const pool = createPool(url);
  const db = createDrizzle(pool);
  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });
    console.log("[db:migrate] applied");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[db:migrate] failed", error);
  process.exit(1);
});
