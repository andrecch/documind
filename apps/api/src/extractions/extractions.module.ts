import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { DatabaseModule } from "../database/database.module";
import { DocumentsModule } from "../documents/documents.module";
import { SettingsModule } from "../settings/settings.module";
import { ExtractionController } from "./extraction.controller";
import { ExtractionService } from "./extraction.service";
import { providerFactory } from "./provider";

@Module({
  imports: [ConfigModule, DatabaseModule, DocumentsModule, SettingsModule],
  controllers: [ExtractionController],
  providers: [ExtractionService, providerFactory],
})
export class ExtractionsModule {}
