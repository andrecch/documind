import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ExtractionsModule } from "../extractions/extractions.module";
import { SearchModule } from "../search/search.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [DatabaseModule, ExtractionsModule, SearchModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
