import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ProvidersModule } from "../extractions/providers.module";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [DatabaseModule, ProvidersModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
