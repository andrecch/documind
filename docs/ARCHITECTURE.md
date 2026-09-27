# DocuMind — Arquitectura

> Estado: **v2.0** · 2026-09-26 · Alineada con el PRD v2 (RAG de documentos validado por humano). Supersede v1.

## 1. Resumen

Monorepo pnpm/Turborepo: Next.js (UI) + NestJS (API) + Postgres/pgvector, con el **loop de ingesta validado por humano** como eje y una capa de recuperación (búsqueda + chat con citas) sobre los vectores.

```
apps/web (Next 15) ──HTTP──▶ apps/api (NestJS 11) ──▶ OpenRouter
   talonario UI                 │  upload · OCR · confirmación      visión · embeddings · chat
   formulario editable          │  embeddings · search · chat
                                ▼ Drizzle
                Postgres 16 + pgvector (Docker, :5433)
```

## 2. Estructura del monorepo

```
apps/web/         # Next.js 15 — talonario UI (Subir, Ficha editable, Búsqueda, Chat, Configuración)
apps/api/         # NestJS 11 — módulos:
│   ├─ documents    upload, storage, preview, estados
│   ├─ extraction   OCR LLM de visión → draft editable (sync + backoff)
│   ├─ confirmation gate + audit (llm vs humano)
│   ├─ embeddings   texto natural padre + chunks hijos → /embeddings
│   ├─ search       kNN pgvector + filtros
│   ├─ chat         retrieve → LLM streaming (SSE) → citas
│   └─ settings     API key cifrada, catálogo free, model_config
packages/shared/  # @documind/shared — Zod (doc types, extraction, audit), validación archivos, contrato LLMProvider
docker-compose.yml
```

## 3. Stack y justificación

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | Next.js 15 App Router, TS strict, Tailwind v4 (mundo Talonario) | SSR + i18n first-class (next-intl) |
| Estado | zustand + TanStack Query | draft editable en cliente; mutaciones con re-validación |
| Formulario | React Hook Form + Zod resolver | edición con validación en vivo del esquema compartido |
| Backend | NestJS 11 (Multer, Swagger) | módulos por dominio del pipeline |
| ORM | Drizzle (`vector()` nativo, transacciones para re-embed) | pgvector first-class |
| DB | PostgreSQL 16 + pgvector (`pgvector/pgvector:pg16`) | JSONB + vector en un motor |
| LLM | Adapter OpenRouter (visión + embeddings + chat, variantes `:free`) | único proveedor free; abstracción para NIM/others |
| Streaming | SSE para el chat | estable sobre HTTP/1.1, sin WS |
| Seguridad | AES-256-GCM (node:crypto) | clave cifrada en BD |

## 4. Modelo de datos v2

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE document_status AS ENUM ('pending','processing','ready_for_review','archived','error');
CREATE TYPE extraction_status AS ENUM ('draft','confirmed');
CREATE TYPE doc_type AS ENUM ('factura','contrato','recibo','documentacion','propuesta');
CREATE TYPE chunk_kind AS ENUM ('document','item');
CREATE TYPE model_purpose AS ENUM ('vision','embedding','chat');

CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     TEXT NOT NULL,
  mime         TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  page_count   INTEGER DEFAULT 1,
  status       document_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una ficha por documento (multi-página agregada)
CREATE TABLE extractions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status         extraction_status NOT NULL DEFAULT 'draft',
  doc_type       doc_type NOT NULL,
  confidence     REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  llm_data       JSONB NOT NULL,        -- lo que reconoció el LLM (inmutable por versión)
  confirmed_data JSONB,                 -- lo que el humano confirmó (null hasta confirmar)
  field_audit    JSONB,                 -- por campo: {field: {llm, human}} diff de la versión
  provider       TEXT NOT NULL,
  model_id       TEXT NOT NULL,
  prompt_tokens  INTEGER,
  completion_tokens INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_extractions_document ON extractions(document_id);

-- Chunks: 1 padre (texto natural del documento) + N hijos por ítem
CREATE TABLE document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  extraction_id UUID NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
  kind        chunk_kind NOT NULL DEFAULT 'document',
  item_index  INTEGER,                   -- null en el padre
  content     TEXT NOT NULL,
  embedding   vector(2048) NOT NULL,     -- Nemotron 3 Embed 1B
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);

-- Chat (M2)
CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  citations  JSONB,                      -- [{documentId, extractionId, chunkKind, itemIndex, field}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE provider_settings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider       TEXT NOT NULL,
  api_key_cipher BYTEA NOT NULL,
  api_key_hint   TEXT NOT NULL,
  is_default     BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE model_config (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider   TEXT NOT NULL,
  purpose    model_purpose NOT NULL,
  model_id   TEXT NOT NULL,
  dimensions INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, purpose, is_default)
);
```

**Seeds:**
```sql
INSERT INTO model_config (provider, purpose, model_id, dimensions) VALUES
  ('openrouter','vision',    'qwen/qwen3.8-27b:free',            NULL),
  ('openrouter','embedding', 'nvidia/nemotron-3-embed-1b:free',  2048),
  ('openrouter','chat',      'qwen/qwen3.8-27b:free',            NULL);
```

## 5. Contratos de API (v1)

Base `http://localhost:4000/api/v1` · Swagger `/docs`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | API + BD + provider config |
| POST | `/documents` | Upload (multipart) → `201 {id, filename, status}` |
| GET | `/documents/:id/file` | Original para preview |
| POST | `/documents/:id/extract` | OCR síncrono (estados + backoff) → draft `{extractionId, docType, confidence, llmData}` |
| GET | `/documents/:id/extraction` | Ficha (draft o confirmed) |
| PATCH | `/documents/:id/extraction` | Edita el draft (valida Zod; guarda auditoría de campos tocados) |
| POST | `/documents/:id/confirm` | **Gate**: valida → genera texto natural → embed padre+ítems → inserta chunks → `ARCHIVADO` |
| PATCH | `/documents/:id/extraction/confirmed` | Edita un archivado → guarda auditoría → **re-embed** transaccional |
| GET | `/documents` | Historial (filtros: tipo, estado, fecha) |
| POST | `/search` | `{query, docType?, from?, to?}` → top-k chunks con documento y fragmento |
| POST | `/chat` | `{message, sessionId}` → SSE stream con respuesta grounded + `citations[]` |
| GET | `/settings/models?purpose&free=true` | Catálogo del proveedor |
| PUT | `/settings/models` | `{purpose, modelId, dimensions?}` |
| PUT | `/settings/provider` | API key (cifrada) → `{hint}` |

**Errores uniformes:** `{ "code", "message", "details" }`.

## 6. Pipeline de ingesta (el corazón)

```
1. POST /documents            → valida → guarda en disco → documents(pending)
2. POST /documents/:id/extract →
   a. PDF → páginas a imagen (pdf.js server, JS puro)
   b. Provider extractStructured(): imágenes dataURL + JSON Schema (de Zod)
      · backoff exponencial ante 429/rate limit · estados: pending→processing→ready_for_review|error
   c. extractions: llm_data (inmutable) + field_audit inicial vacío
3. UI: formulario editable (Ficha) — cada edición → PATCH draft (valida Zod, audita diffs)
4. POST /confirm            → GATE:
   a. Valida confirmed_data con Zod (bloquea si inválido)
   b. Generador de texto natural del documento (idioma del documento)
   c. Embed: 1 chunk padre + N chunks hijos (ítems) vía /embeddings (Nemotron)
   d. Inserta document_chunks en transacción → extractions.confirmed + documents.archived
5. Re-edición de archivados → PATCH confirmed → re-embed transaccional (borra chunks viejos)
```

## 7. Abstracción de proveedores

```ts
export interface LLMProvider {
  readonly id: string;
  extractStructured(input: VisionInput, jsonSchema: object): Promise<{
    raw: unknown; modelId: string; tokens: { prompt: number; completion: number };
  }>;
  embed(inputs: string[]): Promise<number[][]>;
  chatStream(messages: ChatMessage[], opts?: { temperature?: number }): AsyncIterable<string>;
  listModels(purpose: "vision" | "embedding" | "chat", opts?: { freeOnly?: boolean }): Promise<ProviderModel[]>;
}
```

- `OpenRouterAdapter`: chat/completions (imágenes + `response_format: json_schema`), `/embeddings`, chat streaming SSE, `/models`.
- Registry resuelve provider + modelo por propósito desde `model_config` (BD), nunca hardcodeado.
- La API key descifrada solo existe en memoria del backend al llamar al proveedor.

## 8. Estrategia RAG (embeddings + grounding)

- **Texto natural del documento** (padre), generado desde `confirmed_data` con plantilla por tipo de documento, en el idioma del documento: «Factura FAC-2026-0847 emitida por Suministros Andinos S.A. (NIT …) el 2026-09-12, receptor Constructora Delta Ltda., total COP 2.915.500 (impuestos 465.500). Incluye 2 ítems…».
- **Chunks hijos por ítem** (kind=item, item_index): descripción + cantidad + valor → recall fino para búsqueda de líneas específicas.
- **Retrieval**: kNN coseno (top-k 6 por defecto) + filtros (doc_type, fecha). El padre siempre acompaña a sus hijos en los resultados (dédup por document_id con ranking del mejor chunk).
- **Chat grounded**: prompt de sistema estricto («responde SOLO con el contexto; si no está, dilo»); cada afirmación mapea a `citations[] {documentId, field|itemIndex}`; SSE streaming; historial de sesión en `chat_messages`.

## 9. Seguridad de la API key

AES-256-GCM con `DOCUMIND_MASTER_KEY` (env, 32B); formato `bytea = [iv|tag|cipher]`; solo `api_key_hint` (`••••4f2a`) hacia el frontend; prohibido en logs (scrubbing); rotación vía PUT.

## 10. Infraestructura

`docker-compose.yml`: Postgres 16 + pgvector en `:5433` con volumen persistente y healthcheck. Puertos: web 3000, api 4000, Playwright 3101.

## 11. Convenciones

TS strict · lint/typecheck gates (Turbo) · i18n en todo texto visible · commits Convencionales (con confirmación del usuario) · tokens CSS del mundo Talonario (`docs/DESIGN.md`).

## 12. Roadmap técnico

- **M1 — Loop de ingesta**: apps/api + migraciones Drizzle (§4) + upload + OCR + **ficha editable talonario** + confirmar → embed → DB.
- **M2 — Recuperación**: `/search` + `/chat` con citas + Configuración.
- **M3 — Archivo**: historial con filtros, re-embed UX, export.
