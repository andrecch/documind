import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DOCUMENT_TYPES, type DocumentType } from "@documind/shared";

export class SearchQueryDto {
  @ApiProperty({ type: String, minLength: 2, maxLength: 500, example: "instalación eléctrica" })
  query!: string;

  @ApiPropertyOptional({ type: String, enum: DOCUMENT_TYPES })
  docType?: DocumentType;

  @ApiPropertyOptional({ type: Date, format: "date-time", example: "2026-01-01" })
  from?: string;

  @ApiPropertyOptional({ type: Date, format: "date-time", example: "2026-12-31" })
  to?: string;

  @ApiPropertyOptional({ type: Number, default: 6, minimum: 1, maximum: 20 })
  limit?: number;
}

export class SearchHitDto {
  @ApiProperty({ type: String, format: "uuid" })
  chunkId!: string;

  @ApiProperty({ type: String, format: "uuid" })
  documentId!: string;

  @ApiProperty({ type: String, format: "uuid" })
  extractionId!: string;

  @ApiProperty({ type: String })
  filename!: string;

  @ApiProperty({ type: String, enum: DOCUMENT_TYPES })
  docType!: string;

  @ApiProperty({ type: String, enum: ["document", "item"] })
  kind!: string;

  @ApiProperty({ type: Number, nullable: true })
  itemIndex!: number | null;

  @ApiProperty({ type: String })
  content!: string;

  @ApiProperty({ type: Number, nullable: true, description: "null en el padre acompañante" })
  similarity!: number | null;

  @ApiProperty({ type: Date, format: "date-time" })
  createdAt!: string;
}

export class SearchResponseDto {
  @ApiProperty({ type: SearchHitDto, isArray: true })
  items!: SearchHitDto[];

  @ApiProperty({ type: Number, description: "Duración de la búsqueda en ms" })
  tookMs!: number;
}

export class SearchValidationErrorDto {
  @ApiProperty({ example: "VALIDATION_ERROR", type: String })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({ type: String, required: false })
  details?: unknown;
}
