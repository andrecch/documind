import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MODEL_PURPOSES, type ModelPurpose } from "@documind/shared";

export class PutProviderDto {
  @ApiProperty({ type: String, minLength: 20, example: "sk-or-v1-..." })
  apiKey!: string;
}

export class ProviderHintDto {
  @ApiProperty({ type: String, nullable: true, example: "••••4f2a" })
  hint!: string | null;
}

export class PutModelDto {
  @ApiProperty({ type: String, enum: MODEL_PURPOSES })
  purpose!: ModelPurpose;

  @ApiProperty({ type: String, minLength: 1 })
  modelId!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  dimensions?: number | null;
}

export class CurrentModelDto {
  @ApiProperty({ type: String })
  modelId!: string;

  @ApiProperty({ type: Number, nullable: true })
  dimensions!: number | null;
}

export class AvailableModelDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: Boolean })
  free!: boolean;

  @ApiPropertyOptional({ type: Number })
  contextLength?: number;
}

export class ModelsResponseDto {
  @ApiProperty({ type: CurrentModelDto })
  current!: CurrentModelDto | null;

  @ApiProperty({ type: AvailableModelDto, isArray: true })
  available!: AvailableModelDto[];
}

export class MasterKeyErrorDto {
  @ApiProperty({ example: "MASTER_KEY_MISSING", type: String })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;
}
