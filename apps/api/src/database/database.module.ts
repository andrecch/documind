import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigModule, API_ENV } from "../config/config.module";
import type { ApiEnv } from "../config/env";
import { createDrizzle, createPool, type DrizzleDB, type AppPool } from "./drizzle";

export const DRIZZLE_DB = "DRIZZLE_DB";
export const POOL = "POOL";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: POOL,
      useFactory: (env: ApiEnv): AppPool => createPool(env.DATABASE_URL),
      inject: [API_ENV],
    },
    {
      provide: DRIZZLE_DB,
      useFactory: (pool: AppPool): DrizzleDB => createDrizzle(pool),
      inject: [POOL],
    },
  ],
  exports: [DRIZZLE_DB, POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: AppPool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
