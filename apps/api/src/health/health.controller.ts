import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SettingsService, type DefaultModels } from "../settings/settings.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get()
  async check(): Promise<{ status: string; db: string; models: DefaultModels }> {
    let dbState = "up";
    let models: DefaultModels | null = null;
    try {
      models = await this.settings.getDefaultModels();
    } catch (error) {
      dbState = "down";
      console.error("[health] db/models query failed", error);
    }
    return {
      status: dbState === "up" ? "ok" : "degraded",
      db: dbState,
      models: models ?? {
        vision: { modelId: "-", dimensions: null },
        embedding: { modelId: "-", dimensions: null },
        chat: { modelId: "-", dimensions: null },
      },
    };
  }
}
