import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { DocumentsModule } from "./documents/documents.module";
import { ExtractionsModule } from "./extractions/extractions.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, DocumentsModule, ExtractionsModule],
})
export class AppModule {}
