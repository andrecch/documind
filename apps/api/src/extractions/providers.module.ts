import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { SettingsModule } from "../settings/settings.module";
import { providerFactory } from "./provider";

@Module({
  imports: [ConfigModule, DatabaseModule, SettingsModule],
  providers: [providerFactory],
  exports: [providerFactory],
})
export class ProvidersModule {}
