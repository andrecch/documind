import { Injectable, Inject } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE_DB } from "../database/database.module";
import type { DrizzleDB } from "../database/drizzle";
import { dbSchema } from "../database/drizzle";
import type { ModelPurpose } from "@documind/shared";

export type DefaultModels = Record<ModelPurpose, { modelId: string; dimensions: number | null }>;

@Injectable()
export class SettingsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async getDefaultModels(): Promise<DefaultModels> {
    const rows = await this.db
      .select()
      .from(dbSchema.modelConfig)
      .where(and(eq(dbSchema.modelConfig.isDefault, true)));
    const models = { vision: null, embedding: null, chat: null } as Record<
      ModelPurpose,
      { modelId: string; dimensions: number | null } | null
    >;
    for (const row of rows) {
      models[row.purpose] = { modelId: row.modelId, dimensions: row.dimensions };
    }
    return models as DefaultModels;
  }
}
