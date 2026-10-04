import { BadRequestException, Body, Controller, Get, Inject, Put } from "@nestjs/common";
import { Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { z } from "zod";
import type { LLMProvider, ProviderModel } from "@documind/shared";
import { MODEL_PURPOSES } from "@documind/shared";
import { API_ENV } from "../config/config.module";
import type { ApiEnv } from "../config/env";
import { LlmProviderError, PROVIDER } from "../extractions/provider";
import { decryptSecret, encryptSecret, keyHint, MasterKeyError, requireMasterKey } from "./crypto";
import { SettingsService } from "./settings.service";
import {
  CurrentModelDto,
  MasterKeyErrorDto,
  ModelsResponseDto,
  ProviderHintDto,
  PutModelDto,
  PutProviderDto,
} from "./dto";

const putProviderSchema = z.object({ apiKey: z.string().trim().min(20) });
const putModelSchema = z.object({
  purpose: z.enum(MODEL_PURPOSES),
  modelId: z.string().trim().min(1),
  dimensions: z.coerce.number().int().min(1).max(4096).nullable().optional(),
});
const modelsQuerySchema = z.object({
  purpose: z.enum(MODEL_PURPOSES).default("chat"),
  free: z.coerce.boolean().default(true),
});

@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  constructor(
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(PROVIDER) private readonly provider: LLMProvider,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  @Get("provider")
  @ApiOperation({ summary: "Hint de la API key guardada (nunca la clave)" })
  @ApiOkResponse({ type: ProviderHintDto })
  async getProvider(): Promise<ProviderHintDto> {
    const row = await this.settings.getDefaultProviderRow();
    return { hint: row?.apiKeyHint ?? null };
  }

  @Put("provider")
  @ApiOperation({ summary: "Guarda la API key cifrada con DOCUMIND_MASTER_KEY" })
  @ApiOkResponse({ type: ProviderHintDto })
  @ApiBadRequestResponse({ type: MasterKeyErrorDto })
  async putProvider(@Body() body: unknown): Promise<ProviderHintDto> {
    const parsed = putProviderSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "La API key no cumple el formato (mínimo 20 caracteres)",
      });
    }
    try {
      const master = requireMasterKey(this.env.DOCUMIND_MASTER_KEY);
      const cipher = encryptSecret(parsed.data.apiKey, master);
      await this.settings.upsertProviderKey(cipher, keyHint(parsed.data.apiKey));
      return { hint: keyHint(parsed.data.apiKey) };
    } catch (error) {
      if (error instanceof MasterKeyError) {
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }

  @Get("models")
  @ApiOperation({ summary: "Catálogo del proveedor para un propósito + modelo actual de BD" })
  @ApiOkResponse({ type: ModelsResponseDto })
  @ApiQuery({ name: "purpose", enum: MODEL_PURPOSES, required: false })
  @ApiQuery({ name: "free", type: Boolean, required: false })
  async getModels(@Query() query: { purpose?: string; free?: string }): Promise<ModelsResponseDto> {
    const parsed = modelsQuerySchema.safeParse({
      purpose: query.purpose ?? "chat",
      free: query.free ?? "true",
    });
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Parámetros de catálogo inválidos",
      });
    }
    const models = await this.settings.getDefaultModels();
    const current = models[parsed.data.purpose] ?? null;
    let available: ProviderModel[] = [];
    try {
      available = await this.provider.listModels(parsed.data.purpose, {
        freeOnly: parsed.data.free,
      });
    } catch (error) {
      if (error instanceof LlmProviderError) {
        throw new BadRequestException({
          code: "LLM_ERROR",
          message: "No se pudo obtener el catálogo del proveedor",
          details: { reason: error.code },
        });
      }
      throw error;
    }
    return { current, available };
  }

  @Put("models")
  @ApiOperation({ summary: "Cambia el modelo por propósito en model_config (respeta UNIQUE)" })
  @ApiOkResponse({ type: CurrentModelDto })
  async putModel(@Body() body: unknown): Promise<{ modelId: string; dimensions: number | null }> {
    const parsed = putModelSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "El cambio de modelo no cumple el formato",
      });
    }
    const dimensions =
      parsed.data.purpose === "embedding" ? (parsed.data.dimensions ?? null) : null;
    await this.settings.upsertModel(parsed.data.purpose, parsed.data.modelId, dimensions);
    return { modelId: parsed.data.modelId, dimensions };
  }
}
