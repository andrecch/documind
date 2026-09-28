import path from "node:path";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import type { DocumentStatus, DocumentType } from "@documind/shared";
import { DRIZZLE_DB } from "../database/database.module";
import type { DrizzleDB } from "../database/drizzle";
import { dbSchema } from "../database/drizzle";
import { FileStorage } from "./storage";
import { ACCEPTED_MIMES, detectMime, MAX_FILE_BYTES } from "./mime";
import type { DocumentResponseDto } from "./dto";

export class DocumentErrors {
  static notFound(): NotFoundException {
    return new NotFoundException({
      code: "DOCUMENT_NOT_FOUND",
      message: "Documento no encontrado",
    });
  }
  static unsupported(): UnsupportedMediaTypeException {
    return new UnsupportedMediaTypeException({
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: `Tipos permitidos: ${ACCEPTED_MIMES.join(", ")}`,
    });
  }
  static tooLarge(): PayloadTooLargeException {
    return new PayloadTooLargeException({
      code: "FILE_TOO_LARGE",
      message: "El archivo excede el límite de 20 MB",
    });
  }
  static emptyFile(): BadRequestException {
    return new BadRequestException({ code: "EMPTY_FILE", message: "El archivo está vacío" });
  }
}

@Injectable()
export class DocumentsService {
  readonly storage = new FileStorage(
    path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads"),
  );

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async create(file: Express.Multer.File | undefined): Promise<DocumentResponseDto> {
    if (!file || file.size === 0) throw DocumentErrors.emptyFile();
    if (file.size > MAX_FILE_BYTES) throw DocumentErrors.tooLarge();

    const mime = detectMime(file.buffer);
    if (!mime || !ACCEPTED_MIMES.includes(mime)) throw DocumentErrors.unsupported();

    const stored = await this.storage.save(file.buffer, mime);

    const [row] = await this.db
      .insert(dbSchema.documents)
      .values({
        filename: file.originalname,
        mime,
        sizeBytes: stored.sizeBytes,
        storagePath: stored.storagePath,
        status: "pending",
      })
      .returning();
    if (!row) throw new Error("insert returned no row");
    return this.toDto(row);
  }

  async list(filters: {
    status?: DocumentStatus;
    docType?: DocumentType;
    createdFrom?: string;
    createdTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: DocumentResponseDto[]; total: number }> {
    const conditions = [];
    if (filters.status) conditions.push(eq(dbSchema.documents.status, filters.status));
    if (filters.createdFrom)
      conditions.push(gteDate(dbSchema.documents.createdAt, filters.createdFrom));
    if (filters.createdTo)
      conditions.push(lteDate(dbSchema.documents.createdAt, filters.createdTo));
    if (filters.docType) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM ${dbSchema.extractions} WHERE ${dbSchema.extractions.documentId} = ${dbSchema.documents.id} AND ${dbSchema.extractions.docType} = ${filters.docType})`,
      );
    }

    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = filters.offset ?? 0;

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await this.db
      .select()
      .from(dbSchema.documents)
      .where(where)
      .orderBy(desc(dbSchema.documents.createdAt))
      .limit(limit)
      .offset(offset);
    const countRows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(dbSchema.documents)
      .where(where);
    const total = Number(countRows[0]?.count ?? 0);
    return { items: rows.map((row) => this.toDto(row)), total };
  }

  async getOrFail(id: string) {
    const rows = await this.db
      .select()
      .from(dbSchema.documents)
      .where(eq(dbSchema.documents.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) throw DocumentErrors.notFound();
    return row;
  }

  async getFileMeta(id: string) {
    const row = await this.getOrFail(id);
    return { row, absolutePath: this.storage.absolutePath(row.storagePath) };
  }

  toDto(row: typeof dbSchema.documents.$inferSelect): DocumentResponseDto {
    return {
      id: row.id,
      filename: row.filename,
      status: row.status,
      mime: row.mime,
      sizeBytes: row.sizeBytes,
      pageCount: row.pageCount ?? null,
      createdAt: row.createdAt,
    };
  }
}

function gteDate(column: unknown, value: string) {
  return sql`${column} >= ${value}`;
}

function lteDate(column: unknown, value: string) {
  return sql`${column} <= ${value}::timestamptz + interval '1 day' - interval '1 second'`;
}
