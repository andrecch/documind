import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  type DocumentStatus,
  type DocumentType,
} from "@documind/shared";

export class DocumentResponseDto {
  @ApiProperty({ format: "uuid", type: String })
  id!: string;

  @ApiProperty({ type: String })
  filename!: string;

  @ApiProperty({ enum: DOCUMENT_STATUSES, type: String })
  status!: DocumentStatus;

  @ApiProperty({ type: String })
  mime!: string;

  @ApiProperty({ type: Number })
  sizeBytes!: number;

  @ApiProperty({ type: Number, nullable: true })
  pageCount!: number | null;

  @ApiProperty({ type: Date, format: "date-time" })
  createdAt!: Date;
}

export class ListDocumentsQueryDto {
  @ApiPropertyOptional({ enum: DOCUMENT_STATUSES, type: String })
  status?: DocumentStatus;

  @ApiPropertyOptional({ enum: DOCUMENT_TYPES, type: String })
  docType?: DocumentType;

  @ApiPropertyOptional({ type: String, example: "2026-01-01" })
  createdFrom?: string;

  @ApiPropertyOptional({ type: String, example: "2026-12-31" })
  createdTo?: string;

  @ApiPropertyOptional({ type: String, maxLength: 120 })
  q?: string;

  @ApiPropertyOptional({ type: Number, default: 20, maximum: 100 })
  limit?: number;

  @ApiPropertyOptional({ type: Number, default: 0 })
  offset?: number;
}

export class ListDocumentsResponseDto {
  @ApiProperty({ type: DocumentResponseDto, isArray: true })
  items!: DocumentResponseDto[];

  @ApiProperty({ type: Number })
  total!: number;
}

export class DocumentNotFoundDto {
  @ApiProperty({ example: "DOCUMENT_NOT_FOUND", type: String })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;
}

export class DeletedDto {
  @ApiProperty({ type: Boolean })
  ok!: boolean;
}
