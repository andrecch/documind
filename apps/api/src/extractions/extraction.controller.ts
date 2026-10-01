import { Controller, Get, HttpCode, Inject, Param, Post } from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
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
