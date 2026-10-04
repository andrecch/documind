import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { DocumentsModule } from "./documents/documents.module";
import { ExtractionsModule } from "./extractions/extractions.module";
import { HealthModule } from "./health/health.module";
import { SearchModule } from "./search/search.module";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    DocumentsModule,
    ExtractionsModule,
    SearchModule,
  ],
})
export class AppModule {}
