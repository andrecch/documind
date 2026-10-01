import { readFile } from "node:fs/promises";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import type { ExtractionResult, FieldAudit, LLMProvider } from "@documind/shared";
import { diffFields, validateExtraction } from "@documind/shared";
import { DRIZZLE_DB } from "../database/database.module";
import { dbSchema, type DrizzleDB } from "../database/drizzle";
import { DocumentsService } from "../documents/documents.service";
import { Semaphore } from "../common/semaphore";
import { PROVIDER, LlmProviderError } from "./provider";
import { EXTRACTION_JSON_SCHEMA } from "./llm-schema";
import { PdfRenderError, TooManyPagesError, renderPdf } from "./pdf-renderer";
import { buildChunkRows, type ChunkDraft } from "./embed";

export type ExtractResponse = {
  extractionId: string;
  docType: ExtractionResult["doc_type"];
  confidence: number;
  llmData: ExtractionResult;
  tokens: { prompt: number; completion: number };
};

export type ConfirmResult = {
  extractionId: string;
  status: "confirmed";
  chunksInserted: number;
};

export type ExtractionDetail = {
  extractionId: string;
  documentId: string;
  status: "draft" | "confirmed";
  docType: ExtractionResult["doc_type"];
  confidence: number;
  extraction: unknown;
  fieldAudit: unknown;
  tokens: { prompt: number; completion: number };
  createdAt: Date;
  updatedAt: Date;
};

export class ExtractionErrors {
  static notExtracted(): NotFoundException {
    return new NotFoundException({
      code: "EXTRACTION_NOT_FOUND",
      message: "Este documento aún no tiene extracciones",
    });
  }
  static confirmedLocked(): ConflictException {
    return new ConflictException({
      code: "EXTRACTION_CONFIRMED",
      message: "La extracción está confirmada; use la edición de archivados",
    });
  }
  static notConfirmed(): ConflictException {
    return new ConflictException({
      code: "EXTRACTION_NOT_CONFIRMED",
      message: "La extracción sigue en borrador; confirme antes de editar el archivado",
    });
  }
  static validation(error: unknown): BadRequestException {
    return new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Los datos editados no cumplen el esquema de extracción",
      details: error instanceof Error ? error.message : String(error),
    });
  }
  static inProgress(): ConflictException {
    return new ConflictException({
      code: "EXTRACTION_IN_PROGRESS",
      message: "Ya hay una extracción en curso",
    });
  }
  static tooManyPages(pages: number): UnprocessableEntityException {
    return new UnprocessableEntityException({
      code: "TOO_MANY_PAGES",
      message: "El documento supera el límite de páginas por extracción",
      details: { pages },
    });
  }
  static invalidPdf(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      code: "INVALID_PDF",
      message: "El archivo PDF no se pudo procesar",
    });
  }
  static llmError(error: LlmProviderError): BadGatewayException {
    return new BadGatewayException({
      code: "LLM_ERROR",
      message: "El proveedor de IA falló al extraer el documento",
      details: { reason: error.code, status: error.status, detail: error.detail },
    });
  }
  static llmInvalidJson(error: unknown): BadGatewayException {
    return new BadGatewayException({
      code: "LLM_ERROR",
      message: "El proveedor de IA devolvió datos que no cumplen el esquema",
      details: {
        reason: "LLM_INVALID_JSON",
        detail: error instanceof Error ? error.message : String(error),
      },
    });
  }
  static map(error: unknown): unknown {
    if (error instanceof TooManyPagesError) return ExtractionErrors.tooManyPages(error.pages);
    if (error instanceof PdfRenderError) return ExtractionErrors.invalidPdf();
    if (error instanceof LlmProviderError) return ExtractionErrors.llmError(error);
    return error;
  }
}

@Injectable()
export class ExtractionService {
  readonly semaphore = new Semaphore();

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(PROVIDER) private readonly provider: LLMProvider,
  ) {}

  async extract(documentId: string): Promise<ExtractResponse> {
    const doc = await this.documents.getOrFail(documentId);
    if (!this.semaphore.tryAcquire()) throw ExtractionErrors.inProgress();
    try {
      await this.setStatus(documentId, "processing");
      try {
        return await this.runExtraction(doc.id);
      } catch (error) {
        await this.setStatus(documentId, "error");
        throw ExtractionErrors.map(error);
      }
    } finally {
      this.semaphore.release();
    }
  }

  async getExtraction(documentId: string): Promise<ExtractionDetail> {
    await this.documents.getOrFail(documentId);
    const row = await this.latestExtraction(documentId);
    if (!row) throw ExtractionErrors.notExtracted();
    return this.toDetail(row);
  }

  async patchExtraction(documentId: string, data: unknown): Promise<ExtractionDetail> {
    await this.documents.getOrFail(documentId);
    const row = await this.latestExtraction(documentId);
    if (!row) throw ExtractionErrors.notExtracted();
    if (row.status === "confirmed") throw ExtractionErrors.confirmedLocked();

    let edited: ExtractionResult;
    try {
      edited = validateExtraction(data);
    } catch (error) {
      throw ExtractionErrors.validation(error);
    }

    const fieldAudit: FieldAudit = diffFields(row.llmData, edited);
    const changed = Object.keys(fieldAudit).length > 0;
    if (changed) {
      await this.db.transaction(async (tx) => {
        await tx
          .update(dbSchema.extractions)
          .set({
            docType: edited.doc_type,
            confidence: edited.confianza,
            llmData: edited,
            fieldAudit,
            updatedAt: new Date(),
          })
          .where(eq(dbSchema.extractions.id, row.id));
        await tx.insert(dbSchema.extractionRevisions).values({
          extractionId: row.id,
          action: "draft_edit",
          actor: "humano",
          llmData: row.llmData,
          confirmedData: edited,
          fieldAudit,
        });
      });
    }
    const refreshed = await this.latestExtraction(documentId);
    return this.toDetail(refreshed ?? { ...row, llmData: edited, fieldAudit });
  }

  async confirm(documentId: string): Promise<ConfirmResult> {
    await this.documents.getOrFail(documentId);
    const row = await this.latestExtraction(documentId);
    if (!row) throw ExtractionErrors.notExtracted();
    if (row.status === "confirmed") throw ExtractionErrors.confirmedLocked();

    let data: ExtractionResult;
    try {
      data = validateExtraction(row.llmData);
    } catch (error) {
      throw ExtractionErrors.validation(error);
    }

    let chunks: ChunkDraft[];
    try {
      chunks = await buildChunkRows(this.provider, data);
    } catch (error) {
      throw ExtractionErrors.map(error);
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(dbSchema.extractions)
        .set({
          status: "confirmed",
          docType: data.doc_type,
          confidence: data.confianza,
          llmData: data,
          confirmedData: data,
          confirmedAt: now,
          updatedAt: now,
        })
        .where(eq(dbSchema.extractions.id, row.id));
      await tx.insert(dbSchema.extractionRevisions).values({
        extractionId: row.id,
        action: "confirmed",
        actor: "humano",
        llmData: row.llmData,
        confirmedData: data,
        fieldAudit: row.fieldAudit,
      });
      await tx
        .delete(dbSchema.documentChunks)
        .where(eq(dbSchema.documentChunks.documentId, documentId));
      await tx.insert(dbSchema.documentChunks).values(
        chunks.map((chunk) => ({
          documentId,
          extractionId: row.id,
          kind: chunk.kind,
          itemIndex: chunk.itemIndex,
          content: chunk.content,
          embedding: chunk.embedding,
        })),
      );
      await tx
        .update(dbSchema.documents)
        .set({ status: "archivado", updatedAt: now })
        .where(eq(dbSchema.documents.id, documentId));
    });

    return { extractionId: row.id, status: "confirmed", chunksInserted: chunks.length };
  }

  async patchConfirmed(documentId: string, data: unknown): Promise<ExtractionDetail> {
    await this.documents.getOrFail(documentId);
    const row = await this.latestExtraction(documentId);
    if (!row) throw ExtractionErrors.notExtracted();
    if (row.status !== "confirmed") throw ExtractionErrors.notConfirmed();

    let edited: ExtractionResult;
    try {
      edited = validateExtraction(data);
    } catch (error) {
      throw ExtractionErrors.validation(error);
    }

    const fieldAudit: FieldAudit = diffFields(row.llmData, edited);
    if (Object.keys(fieldAudit).length === 0) {
      return this.toDetail(row);
    }

    let chunks: ChunkDraft[];
    try {
      chunks = await buildChunkRows(this.provider, edited);
    } catch (error) {
      throw ExtractionErrors.map(error);
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(dbSchema.extractions)
        .set({
          docType: edited.doc_type,
          confidence: edited.confianza,
          confirmedData: edited,
          fieldAudit,
          updatedAt: now,
        })
        .where(eq(dbSchema.extractions.id, row.id));
      await tx.insert(dbSchema.extractionRevisions).values({
        extractionId: row.id,
        action: "post_confirm_edit",
        actor: "humano",
        llmData: row.llmData,
        confirmedData: edited,
        fieldAudit,
      });
      await tx
        .delete(dbSchema.documentChunks)
        .where(eq(dbSchema.documentChunks.documentId, documentId));
      await tx.insert(dbSchema.documentChunks).values(
        chunks.map((chunk) => ({
          documentId,
          extractionId: row.id,
          kind: chunk.kind,
          itemIndex: chunk.itemIndex,
          content: chunk.content,
          embedding: chunk.embedding,
        })),
      );
      await tx
        .update(dbSchema.documents)
        .set({ updatedAt: now })
        .where(eq(dbSchema.documents.id, documentId));
    });

    const refreshed = await this.latestExtraction(documentId);
    return this.toDetail(refreshed ?? { ...row, confirmedData: edited, fieldAudit });
  }

  private async latestExtraction(documentId: string) {
    const rows = await this.db
      .select()
      .from(dbSchema.extractions)
      .where(eq(dbSchema.extractions.documentId, documentId))
      .orderBy(desc(dbSchema.extractions.createdAt))
      .limit(1);
    return rows[0] ?? undefined;
  }

  private toDetail(row: typeof dbSchema.extractions.$inferSelect): ExtractionDetail {
    const confirmed = row.status === "confirmed";
    return {
      extractionId: row.id,
      documentId: row.documentId,
      status: row.status,
      docType: row.docType,
      confidence: row.confidence,
      extraction: confirmed ? row.confirmedData : row.llmData,
      fieldAudit: row.fieldAudit,
      tokens: {
        prompt: row.promptTokens ?? 0,
        completion: row.completionTokens ?? 0,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async runExtraction(documentId: string): Promise<ExtractResponse> {
    const doc = await this.documents.getOrFail(documentId);
    const images = await this.readImages(doc.id);
    const result = await this.provider.extractStructured({ images }, EXTRACTION_JSON_SCHEMA);
    let llmData: ExtractionResult;
    try {
      llmData = validateExtraction(result.raw);
    } catch (error) {
      throw ExtractionErrors.llmInvalidJson(error);
    }
    const extractionId = await this.replaceExtraction(documentId, llmData, result);
    await this.db
      .update(dbSchema.documents)
      .set({ status: "ready_for_review", pageCount: images.length, updatedAt: new Date() })
      .where(eq(dbSchema.documents.id, documentId));
    return {
      extractionId,
      docType: llmData.doc_type,
      confidence: llmData.confianza,
      llmData,
      tokens: result.tokens,
    };
  }

  private async readImages(
    documentId: string,
  ): Promise<{ imageBase64: string; mimeType: string }[]> {
    const meta = await this.documents.getFileMeta(documentId);
    const buffer = await readFile(meta.absolutePath);
    if (meta.row.mime === "application/pdf") {
      const pages = await renderPdf(buffer);
      return pages.map((page) => ({ imageBase64: page.toString("base64"), mimeType: "image/png" }));
    }
    return [{ imageBase64: buffer.toString("base64"), mimeType: meta.row.mime }];
  }

  private async replaceExtraction(
    documentId: string,
    llmData: ExtractionResult,
    result: { modelId: string; tokens: { prompt: number; completion: number } },
  ): Promise<string> {
    return this.db.transaction(async (tx) => {
      await tx.delete(dbSchema.extractions).where(eq(dbSchema.extractions.documentId, documentId));
      const [row] = await tx
        .insert(dbSchema.extractions)
        .values({
          documentId,
          status: "draft",
          docType: llmData.doc_type,
          confidence: llmData.confianza,
          llmData,
          provider: this.provider.id,
          modelId: result.modelId,
          promptTokens: result.tokens.prompt,
          completionTokens: result.tokens.completion,
        })
        .returning();
      if (!row) throw new Error("insert returned no row");
      await tx.insert(dbSchema.extractionRevisions).values({
        extractionId: row.id,
        action: "created",
        actor: "llm",
        llmData,
      });
      return row.id;
    });
  }

  private async setStatus(documentId: string, status: "processing" | "error"): Promise<void> {
    await this.db
      .update(dbSchema.documents)
      .set({ status, updatedAt: new Date() })
      .where(eq(dbSchema.documents.id, documentId));
  }
}
