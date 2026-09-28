import { Module } from "@nestjs/common";
import { loadEnv, type ApiEnv } from "./env";

export const API_ENV = "API_ENV";

@Module({
  providers: [{ provide: API_ENV, useFactory: loadEnv }],
  exports: [API_ENV],
})
export class ConfigModule {}
