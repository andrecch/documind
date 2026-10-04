import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { DocumentsModule } from "../documents/documents.module";
import { ProvidersModule } from "./providers.module";
import { ExtractionController } from "./extraction.controller";
import { ExtractionService } from "./extraction.service";

@Module({
  imports: [DatabaseModule, DocumentsModule, ProvidersModule],
  controllers: [ExtractionController],
  providers: [ExtractionService],
})
export class ExtractionsModule {}
