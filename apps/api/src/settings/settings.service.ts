import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE_DB } from "../database/database.module";
import type { DrizzleDB } from "../database/drizzle";
import { dbSchema } from "../database/drizzle";
import type { ModelPurpose } from "@documind/shared";

export type DefaultModels = Record<ModelPurpose, { modelId: string; dimensions: number | null }>;

export type ProviderSettingsRow = typeof dbSchema.providerSettings.$inferSelect;

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

  async getDefaultProviderRow(): Promise<ProviderSettingsRow | null> {
    const rows = await this.db
      .select()
      .from(dbSchema.providerSettings)
      .where(and(eq(dbSchema.providerSettings.isDefault, true)))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsertProviderKey(apiKeyCipher: string, apiKeyHint: string): Promise<void> {
    const existing = await this.getDefaultProviderRow();
    if (existing) {
      await this.db
        .update(dbSchema.providerSettings)
        .set({ apiKeyCipher, apiKeyHint, updatedAt: new Date() })
        .where(eq(dbSchema.providerSettings.id, existing.id));
      return;
    }
    await this.db
      .insert(dbSchema.providerSettings)
      .values({ provider: "openrouter", apiKeyCipher, apiKeyHint, isDefault: true });
  }

  async upsertModel(
    purpose: ModelPurpose,
    modelId: string,
    dimensions: number | null,
  ): Promise<void> {
    await this.db
      .insert(dbSchema.modelConfig)
      .values({ provider: "openrouter", purpose, modelId, dimensions, isDefault: true })
      .onConflictDoUpdate({
        target: [dbSchema.modelConfig.provider, dbSchema.modelConfig.purpose],
        set: { modelId, dimensions, isDefault: true, updatedAt: new Date() },
      });
  }
}
