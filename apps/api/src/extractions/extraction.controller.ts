import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import { IsObject } from "class-validator";
import {
  ExtractionService,
  type ExtractionDetail,
  type ExtractResponse,
} from "./extraction.service";

class TokensDto {
  @ApiProperty({ type: Number })
  prompt!: number;

  @ApiProperty({ type: Number })
  completion!: number;
}

class ExtractResponseDto {
  @ApiProperty({ type: String })
  extractionId!: string;

  @ApiProperty({
    type: String,
    enum: ["factura", "contrato", "recibo", "documentacion", "propuesta"],
  })
  docType!: string;

  @ApiProperty({ type: Number })
  confidence!: number;

  @ApiProperty({ type: "object", additionalProperties: true })
  llmData!: Record<string, unknown>;

  @ApiProperty({ type: TokensDto })
  tokens!: TokensDto;
}

class ExtractionDetailDto {
  @ApiProperty({ type: String })
  extractionId!: string;

  @ApiProperty({ type: String })
  documentId!: string;

  @ApiProperty({ type: String, enum: ["draft", "confirmed"] })
  status!: string;

  @ApiProperty({
    type: String,
    enum: ["factura", "contrato", "recibo", "documentacion", "propuesta"],
  })
  docType!: string;

  @ApiProperty({ type: Number })
  confidence!: number;

  @ApiProperty({ type: "object", additionalProperties: true, nullable: true })
  extraction!: Record<string, unknown> | null;

  @ApiProperty({ type: "object", additionalProperties: true, nullable: true })
  fieldAudit!: Record<string, unknown> | null;

  @ApiProperty({ type: TokensDto })
  tokens!: TokensDto;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date })
  updatedAt!: Date;
}

class NotFoundErrorDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;
}

class PatchExtractionDto {
  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description: "Ficha completa editada",
  })
  @IsObject()
  data!: Record<string, unknown>;
}

class ValidationErrorDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({ type: String, required: false })
  details?: string;
}

class ConfirmResponseDto {
  @ApiProperty({ type: String })
  extractionId!: string;

  @ApiProperty({ type: String, enum: ["confirmed"] })
  status!: string;

  @ApiProperty({ type: Number, description: "Chunks insertados (padre + un hijo por fila)" })
  chunksInserted!: number;
}

class ConflictErrorDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;
}

@ApiTags("extractions")
@Controller("documents")
export class ExtractionController {
  constructor(@Inject(ExtractionService) private readonly service: ExtractionService) {}

  @Post(":id/extract")
  @HttpCode(201)
  @ApiOperation({ summary: "OCR del documento (todas las páginas en una pasada)" })
  @ApiCreatedResponse({ type: ExtractResponseDto })
  @ApiNotFoundResponse({ type: NotFoundErrorDto })
  @ApiConflictResponse({ type: ConflictErrorDto })
  async extract(@Param("id") id: string): Promise<ExtractResponseDto> {
    const res: ExtractResponse = await this.service.extract(id);
    return {
      extractionId: res.extractionId,
      docType: res.docType,
      confidence: res.confidence,
      llmData: res.llmData as unknown as Record<string, unknown>,
      tokens: res.tokens,
    };
  }

  @Get(":id/extraction")
  @ApiOperation({ summary: "Ficha del documento: llm_data en draft, confirmed_data si confirmado" })
  @ApiOkResponse({ type: ExtractionDetailDto })
  @ApiNotFoundResponse({ type: NotFoundErrorDto })
  async extraction(@Param("id") id: string): Promise<ExtractionDetailDto> {
    const res: ExtractionDetail = await this.service.getExtraction(id);
    return this.toDetailDto(res);
  }

  @Patch(":id/extraction")
  @ApiOperation({
    summary:
      "Guarda la ficha editada (draft): recalcula field_audit y registra revisión draft_edit",
  })
  @ApiOkResponse({ type: ExtractionDetailDto })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  @ApiNotFoundResponse({ type: NotFoundErrorDto })
  @ApiConflictResponse({ type: ConflictErrorDto })
  async patch(
    @Param("id") id: string,
    @Body() body: PatchExtractionDto,
  ): Promise<ExtractionDetailDto> {
    const res: ExtractionDetail = await this.service.patchExtraction(id, body.data);
    return this.toDetailDto(res);
  }

  @Post(":id/confirm")
  @HttpCode(200)
  @ApiOperation({
    summary: "Gate humano: confirmed_data final → textos naturales → embeddings → archivado",
  })
  @ApiOkResponse({ type: ConfirmResponseDto })
  @ApiNotFoundResponse({ type: NotFoundErrorDto })
  @ApiConflictResponse({ type: ConflictErrorDto })
  async confirm(@Param("id") id: string): Promise<ConfirmResponseDto> {
    return this.service.confirm(id);
  }

  @Patch(":id/extraction/confirmed")
  @ApiOperation({
    summary: "Edición de archivado: recalcula field_audit y re-inserta embeddings (delete+insert)",
  })
  @ApiOkResponse({ type: ExtractionDetailDto })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  @ApiNotFoundResponse({ type: NotFoundErrorDto })
  @ApiConflictResponse({ type: ConflictErrorDto })
  async patchConfirmed(
    @Param("id") id: string,
    @Body() body: PatchExtractionDto,
  ): Promise<ExtractionDetailDto> {
    const res: ExtractionDetail = await this.service.patchConfirmed(id, body.data);
    return this.toDetailDto(res);
  }

  private toDetailDto(res: ExtractionDetail): ExtractionDetailDto {
    return {
      extractionId: res.extractionId,
      documentId: res.documentId,
      status: res.status,
      docType: res.docType,
      confidence: res.confidence,
      extraction: (res.extraction ?? null) as Record<string, unknown> | null,
      fieldAudit: (res.fieldAudit ?? null) as Record<string, unknown> | null,
      tokens: res.tokens,
      createdAt: res.createdAt,
      updatedAt: res.updatedAt,
    };
  }
}
