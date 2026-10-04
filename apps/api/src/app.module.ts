import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { DocumentsModule } from "./documents/documents.module";
import { ExtractionsModule } from "./extractions/extractions.module";
import { HealthModule } from "./health/health.module";
import { ChatModule } from "./chat/chat.module";
import { SearchModule } from "./search/search.module";
import { SettingsApiModule } from "./settings/settings-api.module";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    DocumentsModule,
    ExtractionsModule,
    SearchModule,
    ChatModule,
    SettingsApiModule,
  ],
})
export class AppModule {}
