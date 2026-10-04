import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ExtractionsModule } from "../extractions/extractions.module";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [DatabaseModule, ExtractionsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
