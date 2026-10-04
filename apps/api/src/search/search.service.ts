import { BadGatewayException, Inject, Injectable } from "@nestjs/common";
import type {
  LLMProvider,
  SearchHit,
  SearchRequest,
  SearchResponse,
  SearchHitKind,
} from "@documind/shared";
import type { AppPool } from "../database/drizzle";
import { POOL } from "../database/database.module";
import { LlmProviderError, PROVIDER } from "../extractions/provider";

type ChunkRow = {
  chunk_id: string;
  document_id: string;
  extraction_id: string;
  kind: "document" | "item";
  item_index: number | null;
  content: string;
  filename: string;
  doc_type: string;
  created_at: Date;
};

type SimilarRow = ChunkRow & { similarity: number };

const KNN_SQL = `
  SELECT c.id AS chunk_id, c.document_id, c.extraction_id, c.kind, c.item_index, c.content,
         1 - (c.embedding::halfvec(2048) <=> $1::halfvec(2048))::float8 AS similarity,
         d.filename, d.created_at, e.doc_type::text AS doc_type
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    JOIN extractions e ON e.id = c.extraction_id
   WHERE ($2::text IS NULL OR e.doc_type::text = $2)
     AND ($3::timestamptz IS NULL OR d.created_at >= $3)
     AND ($4::timestamptz IS NULL OR d.created_at <= $4)
   ORDER BY c.embedding::halfvec(2048) <=> $1::halfvec(2048)
   LIMIT $5
`;

const PARENT_SQL = `
  SELECT c.id AS chunk_id, c.document_id, c.extraction_id, c.kind, c.item_index, c.content,
         d.filename, d.created_at, e.doc_type::text AS doc_type
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    JOIN extractions e ON e.id = c.extraction_id
   WHERE c.document_id = ANY($1::uuid[]) AND c.kind = 'document'
`;

@Injectable()
export class SearchService {
  constructor(
    @Inject(POOL) private readonly pool: AppPool,
    @Inject(PROVIDER) private readonly provider: LLMProvider,
  ) {}

  async search(req: SearchRequest): Promise<SearchResponse> {
    const startedAt = performance.now();
    let vector: number[] | undefined;
    try {
      [vector] = await this.provider.embed([req.query]);
    } catch (error) {
      if (!(error instanceof LlmProviderError)) throw error;
      throw new BadGatewayException({
        code: "SEARCH_EMBED_ERROR",
        message: "No se pudo calcular el vector de la consulta",
        details: {
          reason: "embed",
          provider: { code: error.code, status: error.status, detail: error.detail },
        },
      });
    }
    if (!vector)
      throw new BadGatewayException({
        code: "SEARCH_EMBED_ERROR",
        message: "El proveedor no devolvió vector para la consulta",
        details: { reason: "embed" },
      });
    const vectorLiteral = `[${vector.join(",")}]`;

    const { rows } = await this.pool.query<SimilarRow>(KNN_SQL, [
      vectorLiteral,
      req.docType ?? null,
      req.from ?? null,
      req.to ?? null,
      req.limit,
    ]);

    const bestByDoc = new Map<string, SimilarRow>();
    for (const row of rows) {
      if (!bestByDoc.has(row.document_id)) bestByDoc.set(row.document_id, row);
    }

    const missingParentDocs = [...bestByDoc.values()]
      .filter((row) => row.kind === "item")
      .map((row) => row.document_id);
    const parents = new Map<string, ChunkRow>();
    if (missingParentDocs.length > 0) {
      const parentRows = await this.pool.query<ChunkRow>(PARENT_SQL, [missingParentDocs]);
      for (const row of parentRows.rows) parents.set(row.document_id, row);
    }

    const ordered = [...bestByDoc.values()].sort((a, b) => b.similarity - a.similarity);
    const items: SearchHit[] = [];
    for (const best of ordered) {
      items.push(this.toHit(best, best.similarity));
      if (best.kind === "item") {
        const parent = parents.get(best.document_id);
        if (parent) items.push(this.toHit(parent, null));
      }
    }

    return { items, tookMs: Math.round(performance.now() - startedAt) };
  }

  private toHit(row: ChunkRow, similarity: number | null): SearchHit {
    return {
      chunkId: row.chunk_id,
      documentId: row.document_id,
      extractionId: row.extraction_id,
      filename: row.filename,
      docType: row.doc_type as SearchHit["docType"],
      kind: row.kind as SearchHitKind,
      itemIndex: row.item_index,
      content: row.content,
      similarity,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
