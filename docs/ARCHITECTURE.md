# DocuMind — Arquitectura

> Estado: **v2.1** · 2026-10-01 · Actualizada tras el cierre de M1: refleja el esquema, contratos y decisiones realmente implementados (antes v2.0 · 2026-09-26, diseño objetivo).

## 1. Resumen

Monorepo pnpm/Turborepo: Next.js (UI) + NestJS (API) + Postgres/pgvector, con el **loop de ingesta validado por humano** como eje y una capa de recuperación (búsqueda + chat con citas) sobre los vectores.

```
apps/web (Next 15) ──proxy /api/*──▶ apps/api (NestJS 11) ──▶ OpenRouter
   talonario UI                 │  upload · OCR · confirmación      visión · embeddings · chat
    formulario editable          │  embeddings · search · chat
                                 ▼ Drizzle
                 Postgres 16 + pgvector (Docker, :5433)
```

## 2. Estructura del monorepo (M1 implementado)

```
apps/web/         # Next.js 15 — talonario UI: Subir (+historial), Review con ficha editable. Search/Chat/Config: M2
apps/api/         # NestJS 11 — módulos implementados en M1:
│   ├─ documents    upload, storage en disco, preview con Range, listing con filtros
│   ├─ extractions  pipeline completo: pdf-renderer · llm-schema · provider (OpenRouter fetch + fake)
│   │               · extraction.service (extract/PATCH/confirm/re-embed) · embed · natural-text
│   ├─ settings     lectura de model_config (seeds)
│   ├─ health       API + BD + modelos
│   └─ database     Drizzle + migraciones + seed
#   (pendientes M2: search, chat; settings UI/cifrada)
packages/shared/  # @documind/shared — Zod (doc types, extraction v2, audit), validación archivos, contrato LLMProvider
docker-compose.yml
```

## 3. Stack y justificación

| Capa       | Elección                                                           | Por qué                                                        |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Frontend   | Next.js 15 App Router, TS strict, Tailwind v4 (mundo Talonario)    | SSR + i18n first-class (next-intl)                             |
| Estado     | zustand (doc activo en memoria)                                    | MVP personal sin caché servidor; fetch directo en `lib/api.ts` |
| Formulario | ficha controlada propia + debounce 800 ms → PATCH                  | validación real la hace el servidor con Zod compartido         |
| Backend    | NestJS 11 (Multer, Swagger)                                        | módulos por dominio del pipeline                               |
| ORM        | Drizzle (`vector()` nativo, transacciones para re-embed)           | pgvector first-class                                           |
| DB         | PostgreSQL 16 + pgvector (`pgvector/pgvector:pg16`)                | JSONB + vector en un motor                                     |
| LLM        | Adapter OpenRouter (visión + embeddings + chat, variantes `:free`) | único proveedor free; abstracción para NIM/others              |
| Streaming  | SSE para el chat                                                   | estable sobre HTTP/1.1, sin WS                                 |
| Seguridad  | AES-256-GCM (node:crypto)                                          | clave cifrada en BD                                            |

## 4. Modelo de datos v2

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE document_status AS ENUM ('pending','processing','ready_for_review','archivado','error');
CREATE TYPE extraction_status AS ENUM ('draft','confirmed');
CREATE TYPE doc_type AS ENUM ('factura','contrato','recibo','documentacion','propuesta');
CREATE TYPE chunk_kind AS ENUM ('document','item');
CREATE TYPE revision_action AS ENUM ('created','draft_edit','confirmed','post_confirm_edit');
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
CREATE INDEX idx_documents_status_created ON documents(status, created_at);

-- Una ficha por documento (multi-página agregada)
CREATE TABLE extractions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status         extraction_status NOT NULL DEFAULT 'draft',
  doc_type       doc_type NOT NULL,
  confidence     REAL NOT NULL,
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

-- Historial append-only: cada acción deja snapshot llm_data + confirmed_data + field_audit
CREATE TABLE extraction_revisions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id  UUID NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
  action         revision_action NOT NULL,
  actor          TEXT NOT NULL,                 -- 'llm' | 'humano'
  llm_data       JSONB NOT NULL,
  confirmed_data JSONB,
  field_audit    JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_revisions_extraction ON extraction_revisions(extraction_id);

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
-- HNSW no admite >2000 dims nativamente → índice sobre halfvec(2048)
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);

-- Chat (M2 — tabla aún no creada)
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_model_config_provider_purpose ON model_config(provider, purpose);
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

| Método | Ruta                                  | Descripción                                                                                                      |
| ------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                             | API + BD + provider config                                                                                       |
| POST   | `/documents`                          | Upload (multipart) → `201 {id, filename, status}`                                                                |
| GET    | `/documents/:id/file`                 | Original para preview                                                                                            |
| POST   | `/documents/:id/extract`              | OCR síncrono (semáforo 409 · cap 8 páginas 422 · backoff) → draft `{extractionId, docType, confidence, llmData}` |
| GET    | `/documents/:id/extraction`           | Ficha (draft o confirmed)                                                                                        |
| PATCH  | `/documents/:id/extraction`           | Edita el draft (valida Zod; servidor recalcula `field_audit`; 409 si está confirmada)                            |
| POST   | `/documents/:id/confirm`              | **Gate**: valida → genera texto natural → embed padre+ítems → inserta chunks → `archivado`                       |
| PATCH  | `/documents/:id/extraction/confirmed` | Edita un archivado → guarda auditoría → **re-embed** transaccional                                               |
| GET    | `/documents`                          | Historial (filtros: tipo, estado, fecha)                                                                         |
| POST   | `/search`                             | (M2) `{query, docType?, from?, to?}` → top-k chunks con documento y fragmento                                    |
| POST   | `/chat`                               | (M2) `{message, sessionId}` → SSE stream con respuesta grounded + `citations[]`                                  |
| GET    | `/settings/models?purpose&free=true`  | (M2) Catálogo del proveedor                                                                                      |
| PUT    | `/settings/models`                    | (M2) `{purpose, modelId, dimensions?}`                                                                           |
| PUT    | `/settings/provider`                  | (M2) API key (cifrada) → `{hint}`                                                                                |

**Errores uniformes:** `{ "code", "message", "details" }`.

## 6. Pipeline de ingesta (el corazón — implementado en M1)

```
1. POST /documents             → valida MIME real → guarda en disco (UPLOAD_DIR, mes/uuid) → documents(pending)
2. POST /documents/:id/extract →
   a. Semáforo en memoria (máx 1; segunda petición → 409 EXTRACTION_IN_PROGRESS)   [decisión 13]
   b. PDF → PNG por página con `pdf-to-img` (pdf.js + @napi-rs/canvas); > 8 páginas → 422 TOO_MANY_PAGES
      imagen → dataURL directo (1 página)
   c. Provider extractStructured(): imágenes dataURL + JSON Schema espejo de Zod
      (`response_format: json_schema` + `usage: {include:true}`); si el JSON viene
      malformado → 1 retry con prompt de corrección; backoff exponencial + jitter
      ante 429/5xx/timeout (máx 5) → 502 LLM_ERROR y documents(error)
   d. extractions: llm_data + revisión `created` (actor llm); re-extract = delete+insert
      documents: ready_for_review + page_count
3. UI: ficha editable talonario — cada edición → PATCH draft (debounce 800 ms; el
   servidor recalcula field_audit con diffFields y registra `draft_edit` solo si hay diff)
4. POST /confirm            → GATE:
   a. Valida llm_data con Zod
   b. Texto natural del documento (plantilla por doc_type, idioma es — docs es/es)
   c. Embed: 1 chunk padre + N hijos (ítems) vía /embeddings (Nemotron, 2048 dims)
   d. Transacción: extractions.confirmed + confirmed_data/confirmed_at + revisión
      `confirmed` + insert document_chunks + documents(archivado)
   e. re-confirmar → 409 EXTRACTION_CONFIRMED (idempotente)
5. Re-edición de archivados → PATCH /extraction/confirmed → field_audit recalculado +
   re-embed transaccional (delete+insert de chunks) + revisión `post_confirm_edit`
```

## 7. Abstracción de proveedores (contrato M1 real en `packages/shared/llm.ts`)

```ts
export type VisionImage = { imageBase64: string; mimeType: string };
export type VisionInput = { images: VisionImage[] }; // N páginas = N imágenes, una pasada

export interface LLMProvider {
  readonly id: string;
  extractStructured(
    input: VisionInput,
    jsonSchema: object,
  ): Promise<{
    raw: unknown;
    modelId: string;
    tokens: { prompt: number; completion: number };
  }>;
  embed(inputs: string[]): Promise<number[][]>;
  chatStream(messages: ChatMessage[]): AsyncGenerator<ChatStreamChunk>; // M1: throw "no implementado" (M2)
  listModels(
    purpose: "vision" | "embedding" | "chat",
    opts?: { freeOnly?: boolean },
  ): Promise<ProviderModel[]>;
}
```

- `OpenRouterProvider` (`apps/api/src/extractions/provider.ts`): **fetch directo** a `https://openrouter.ai/api/v1` — chat/completions con `response_format: json_schema` + `usage`, `/embeddings`, `/models`. `FakeProvider` bajo `DOCUMIND_FAKE_PROVIDERS=1`. La factoría DI (`PROVIDER`) resuelve modelo por propósito desde `model_config` (BD), nunca hardcodeado.
- Backoff exponencial + jitter (429/5xx/timeout, máx 5 intentos) y 1 retry con prompt de corrección cuando el JSON del LLM viene malformado.
- **M1**: la API key vive solo en el entorno (`OPENROUTER_API_KEY`, leído de `apps/api/.env` o del `.env` de la raíz). El cifrado en `provider_settings` (AES-256-GCM) y su UI llegan en M2; la clave descifrada solo existe en memoria del backend al llamar al proveedor.

## 8. Estrategia RAG (embeddings + grounding)

- **Texto natural del documento** (padre), generado desde `confirmed_data` con plantilla por tipo de documento (M1: plantillas en español — corpus es; detección de idioma se evaluará si llegan documentos en otros idiomas): «Factura FAC-2026-0847 emitida por Suministros Andinos S.A. (NIT …) · fecha 2026-09-12 · total COP 2915500».
- **Ítems como tabla genérica**: `packages/shared` define `DOC_TYPE_TABLE_SCHEMA` — columnas (key, label, tipo, orden) por tipo de documento. Las filas de `llm_data`/`confirmed_data` son `Array<Record<string, string|number>>`; el prompt del LLM usa los nombres de clave del esquema, la UI (ItemsGrid) renderiza las mismas columnas y el generador de texto natural las recorre. Soporta documentos densos reales (declaración DIAN ~15 columnas × N filas).
- **Chunks hijos por fila de tabla** (kind=item, item_index=fila): texto natural de la fila con sus columnas etiquetadas → recall fino para líneas específicas.
- **Retrieval**: kNN coseno (top-k 6 por defecto) + filtros (doc_type, fecha). El padre siempre acompaña a sus hijos en los resultados (dédup por document_id con ranking del mejor chunk).
- **Chat grounded**: prompt de sistema estricto («responde SOLO con el contexto; si no está, dilo»); cada afirmación mapea a `citations[] {documentId, field|itemIndex}`; SSE streaming; historial de sesión en `chat_messages`.

## 9. Seguridad de la API key

**M1 (implementado)**: `OPENROUTER_API_KEY` solo por entorno/`.env` (decisión 11 — respaldo), nunca en logs ni hacia el frontend. **M2**: AES-256-GCM con `DOCUMIND_MASTER_KEY` (env, 32B); formato `bytea = [iv|tag|cipher]` en `provider_settings`; solo `api_key_hint` (`••••4f2a`) hacia el frontend; rotación vía PUT.

## 10. Infraestructura

`docker-compose.yml`: Postgres 16 + pgvector en `:5433` con volumen persistente y healthcheck. Puertos: web 3000, api 4000, Playwright 3101 (build de producción de la web). La web llama a la API por **proxy rewrite de Next** (`/api/*` → `http://localhost:4000/api/v1/*`, configurable con `API_PROXY_URL`): un solo origen, sin CORS (decisión 12). Archivos subidos a `UPLOAD_DIR` (relativa al cwd; por defecto `uploads/` → `apps/api/uploads` al correr con pnpm filters), fuera de git.

## 11. Convenciones

TS strict · lint/typecheck gates (Turbo) · i18n en todo texto visible · commits Convencionales (con confirmación del usuario) · tokens CSS del mundo Talonario (`docs/DESIGN.md`).

## 12. Roadmap técnico

- **M1 — Loop de ingesta** ✅ (2026-10-01): apps/api + migraciones Drizzle (§4) + upload + OCR + **ficha editable talonario** + confirmar → embed → DB + re-embed en archivados (API) + historial mínimo.
- **M2 — Recuperación**: `/search` + `/chat` con citas + Configuración (key cifrada, catálogo).
- **M3 — Archivo**: historial con filtros avanzados, re-embed UX de archivados en la web, export.
