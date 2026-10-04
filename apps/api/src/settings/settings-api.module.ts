import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { ProvidersModule } from "../extractions/providers.module";
import { SettingsModule } from "./settings.module";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [ConfigModule, DatabaseModule, ProvidersModule, SettingsModule],
  controllers: [SettingsController],
})
export class SettingsApiModule {}
