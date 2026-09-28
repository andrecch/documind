import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { SettingsModule } from "../settings/settings.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [HealthController],
})
export class HealthModule {}
