# DocuMind â€” Arquitectura

> Estado: v1.0 Â· 2026-09-26 Â· Complementa `docs/PRD.md`

## 1. Resumen

Monorepo pnpm/Turborepo con tres piezas:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ apps/web (Next 15) â”‚â”€â”€â”€â”€â”€â–¶â”‚ apps/api (NestJS 11, M1)â”‚â”€â”€â”€â”€â”€â–¶â”‚ Apps: OpenRouter â”‚
â”‚  drag&drop, previewâ”‚ HTTP â”‚  upload, pipeline,_cfg  â”‚      â”‚  visiÃ³n/embeddingâ”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
        @documind/shared (Zod, tipos)   â”‚ Drizzle ORM
                                        â–¼
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚ Postgres 16 + pgvector (Docker)â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Fase actual (UI inicial):** solo `apps/web`, `packages/shared` e infra Docker. `apps/api` aparece en M1.

## 2. Estructura del monorepo

```
documind/
â”œâ”€ apps/
â”‚  â”œâ”€ web/                     # Next.js 15 (App Router) â€” UI
â”‚  â”‚  â””â”€ src/
â”‚  â”‚     â”œâ”€ app/[locale]/      # pages: /, /review  (+ /settings en M2)
â”‚  â”‚     â”œâ”€ components/        # navbar, upload-dropzone, document-preview, json-panel, theme-toggle
â”‚  â”‚     â”œâ”€ i18n/              # next-intl: routing, request, navigation
â”‚  â”‚     â”œâ”€ lib/store.ts       # zustand: documento activo en memoria
â”‚  â”‚     â””â”€ messages/          # es.json, en.json
â”‚  â””â”€ api/                     # NestJS 11 (M1) â€” mÃ³dulos: documents, llm, settings
â”œâ”€ packages/
â”‚  â””â”€ shared/                  # @documind/shared â€” tipos, esquemas Zod, validaciÃ³n archivos
â”œâ”€ docker-compose.yml          # Postgres 16 + pgvector
â”œâ”€ docs/                       # PRD, ARCHITECTURE, DESIGN, plans/
â”œâ”€ turbo.json
â””â”€ pnpm-workspace.yaml
```

## 3. Stack y justificaciÃ³n

| Capa | ElecciÃ³n | Por quÃ© |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | EstÃ¡ndarersh para TS; cachÃ© de tareas y pipelines simples |
| Frontend | Next.js 15 App Router, TS strict, Tailwind v4 | SSR y file routing, ecosistema grande, i18n first-class con next-intl |
| UI kit | Componentes propios con tokens CSS (Aurora) | Control total del look; MVP no necesita librerÃ­a completa |
| Estado | zustand (documento activo) + TanStack Query (server state en M1) | MÃ­nimo y suficiente |
| Upload | react-dropzone + pdfjs-dist (preview PDF) | Drag & drop accesible + render PDF sin dependencias nativas |
| Backend (M1) | NestJS 11 | MÃ³dulos/DI, Multer, Swagger/OpenAPI, testing integrado |
| ORM (M1) | Drizzle | Soporte nativo de `vector()` (pgvector), TS-first |
| DB | PostgreSQL 16 + pgvector (imagen `pgvector/pgvector:pg16`) | JSONB + embeddings vectoriales en un solo motor |
| LLM | Adapter OpenRouter (visiÃ³n + embeddings, variantes `:free`) | Ãšnico proveedor sin costo vigente; abstracciÃ³n lista para NVIDIA NIM y otros |
| Seguridad | AES-256-GCM (node:crypto) para API keys en BD | EstÃ¡ndar de cifrado simÃ©trico autenticado |
| Testing | Vitest (shared), e2e Playwright (flujos UI) | RÃ¡pido y estÃ¡ndar |

## 4. Modelo de datos (M1â€“M2)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE document_status AS ENUM ('pending', 'processing', 'done', 'error');
CREATE TYPE doc_type AS ENUM ('factura', 'contrato', 'recibo', 'documentacion', 'propuesta');
CREATE TYPE model_purpose AS ENUM ('vision', 'embedding');

CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  storage_path  TEXT NOT NULL,              -- uploads/ en disco (volumen Docker)
  status        document_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE extractions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  doc_type          doc_type NOT NULL,
  confidence        REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  data              JSONB NOT NULL,
  provider          TEXT NOT NULL,          -- 'openrouter' | 'nvidia-nim' | ...
  model_id          TEXT NOT NULL,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_extractions_document ON extractions(document_id);

-- Fase 2 de BÃºsqueda: chunks + embeddings (pgvector)
CREATE TABLE document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page        INTEGER,
  content     TEXT NOT NULL,
  embedding   vector(2048) NOT NULL       -- Nemotron 3 Embed 1B: 2048 dims
);
CREATE INDEX idx_chunks_embedding
  ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ConfiguraciÃ³n de proveedor
CREATE TABLE provider_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL,
  api_key_cipher BYTEA NOT NULL,            -- AES-256-GCM: [iv|tag|ciphertext]
  api_key_hint  TEXT NOT NULL,              -- 'sk-or-â€¦4f2a' (mÃ¡scara para UI)
  is_default    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE model_config (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider   TEXT NOT NULL,
  purpose    model_purpose NOT NULL,
  model_id   TEXT NOT NULL,
  dimensions INTEGER,                        -- 2048 para Nemotron 3 Embed 1B
  is_default BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, purpose, is_default)
);
```

**Seeds:**
```sql
INSERT INTO model_config (provider, purpose, model_id, dimensions) VALUES
  ('openrouter', 'vision',    'qwen/qwen3.8-27b:free',        NULL),
  ('openrouter', 'embedding', 'nvidia/nemotron-3-embed-1b:free', 2048);
```

## 5. Contratos de API (v1, apps/api â€” M1/M2)

Base: `http://localhost:4000/api/v1` Â· Swagger en `/docs`.

| MÃ©todo | Ruta | DescripciÃ³n |
|---|---|---|
| GET | `/health` | Estado de la API y la BD |
| POST | `/documents` | Upload (multipart `file`, mÃ¡x 20 MB) â†’ `201 {id, filename, mime, sizeBytes, status, previewUrl}` |
| GET | `/documents` | Lista con paginaciÃ³n (`?page&limit&type`) |
| GET | `/documents/:id` | Detalle + Ãºltima extracciÃ³n |
| POST | `/documents/:id/extract` | Pasada LLM: clasificar + extraer â†’ `{docType, confidence, data}` |
| GET | `/documents/:id/file` | Serve el archivo original (preview) |
| PUT | `/settings/provider` | Guarda API key (body `{key}`) â†’ `{hint}`; la clave nunca se devuelve |
| GET | `/settings/models?purpose=vision&free=true` | CatÃ¡logo de modelos gratis del proveedor |
| PUT | `/settings/models` | `{purpose, modelId, dimensions?}` â†’ persiste selecciÃ³n |
| POST | `/search` | (fase 2) BÃºsqueda semÃ¡ntica por embeddings |

**Formato de error uniforme:**
```json
{ "code": "PROVIDER_TIMEOUT", "message": "â€¦", "details": {} }
```

## 6. Pipeline de extracciÃ³n (M1)

```
1. POST /documents      â†’ Multer valida MIME/tamaÃ±o â†’ guarda en disco â†’ row `documents(pending)`
2. POST /:id/extract    â†’
   a. Si PDF â†’ pdf-lib/pdfjs srv (JS puro) renderiza pÃ¡ginas â†’ PNG base64
   b. Provider extractStructured(): chat/completions con imÃ¡genes (dataURL)
      + response_format JSON Schema (generado del esquema Zod compartido)
   c. Validar salida con Zod          â†’ error? 1 reintento con "corrige tu JSON"
   d. Persistir extractions(doc_type, confidence, data, model, tokens)
   e. Marcar done â†’ 200 JSON al frontend
3. (Fase 2) Tras extracciÃ³n: chunking del texto â†’ POST /embeddings â†’ document_chunks
```

## 7. AbstracciÃ³n de proveedores LLM

```ts
// packages/shared/src/llm.ts â€” el contrato que cualquier proveedor debe cumplir
export type VisionInput =
  | { imageBase64: string; mimeType: string }
  | { pdfBase64: string };

export interface ProviderModel { id: string; label: string; free: boolean; contextLength?: number; }

export interface LLMProvider {
  readonly id: string;                     // 'openrouter' | 'nvidia-nim' | ...
  extractStructured(input: VisionInput, jsonSchema: object): Promise<{
    raw: unknown; modelId: string; tokens: { prompt: number; completion: number };
  }>;
  embed(inputs: string[]): Promise<number[][]>;
  listModels(purpose: "vision" | "embedding", opts?: { freeOnly?: boolean }): Promise<ProviderModel[]>;
}
```

- `OpenRouterAdapter` (M1): implementa el contrato con `POST /api/v1/chat/completions` (imÃ¡genes dataURL + `response_format: {type:"json_schema", json_schema:{...}}`) y `POST /api/v1/embeddings`; catÃ¡logo vÃ­a `/api/v1/embeddings/models` y `/api/v1/models`.
- `NvidiaNimAdapter` (futuro): la API de NIM es compatible OpenAI â€” el mismo adapter con base URL distinta.
- **Registry** en el backend: `Registry.get('openrouter')` resuelve el adapter desde `model_config`/`provider_settings` (BD), no del cÃ³digo.
- Cambiar de modelo o de proveedor = actualizar la BD desde la pantalla de ConfiguraciÃ³n. NingÃºn SDK o slug hardcodeado.
- Fuente de verdad de la key: BD (cifrada), leÃ­da solo por el backend al momento de la llamada.

## 8. Seguridad de la API key (estÃ¡ndar aplicado)

1. **Cifrado en reposo**: AES-256-GCM (`crypto.createCipheriv`) con clave maestra de 32 bytes desde `.env` (`DOCUMIND_MASTER_KEY`), nunca en la BD ni en el repo.
2. **Formato**: `bytea = [12B iv | 16B authTag | ciphertext]`; descifrado verificado con authTag (integridad).
3. **ExposiciÃ³n mÃ­nima**: la API solo devuelve `api_key_hint` (`sk-or-â€¦4f2a`); la clave descifrada solo existe en memoria del backend para la llamada al proveedor.
4. **Logs**: prohibido registrar la clave o el Authorization; interceptor de logs con scrubbing.
5. **RotaciÃ³n**: endpoint PUT reemplaza la clave; DELETE invalida. Sin sÃ­, siempre se cifra la Ãºltima versiÃ³n.
6. **Transporte**: HTTPS en producciÃ³n; SameSite+CSRF en la pantalla de settings.

## 9. Infraestructura local (Docker)

`docker-compose.yml` (fase actual): servicio `db` con `pgvector/pgvector:pg16`, puerto **5433** (evita colisiÃ³n con una instancia local de Postgres), volumen persistente `documind_pgdata` y healthcheck `pg_isready`. La app web no habla con la BD aÃºn; el API (M1) la consumirÃ¡ via `DATABASE_URL=postgres://documind:documind@localhost:5433/documind`.

## 10. Convenciones

- TypeScript `strict` en todos los paquetes; lint + typecheck como gates (Turbo).
- Rutas y nombres de cÃ³digo en inglÃ©s; **textos de UI solo vÃ­a i18n** (`messages/es.json`, `en.json`).
- Commits Convencionales `feat|fix|chore|docs: â€¦` (siempre con confirmaciÃ³n del usuario).
- CSS con tokens (variables CSS) â€” sin hex sueltos en componentes; ver `docs/DESIGN.md`.
- Puertos: web `3000`, api `4000`, postgres `5433`, Playwright webServer `3101`.

## 11. Roadmap tÃ©cnico

- **UI inicial (M0)** â€” scaffold, tokens, i18n, tema, 2 pantallas, e2e smoke.
- **M1** â€” `apps/api`, migraciones Drizzle, upload + extractor LLM + persistencia.
- **M2** â€” pantalla de ConfiguraciÃ³n, embeddings, bÃºsqueda semÃ¡ntica `/search`.
- **M3** â€” historial con filtros, export, afinado visual (skill interface-design).
