import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ProvidersModule } from "../extractions/providers.module";
import { SearchModule } from "../search/search.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [DatabaseModule, ProvidersModule, SearchModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
