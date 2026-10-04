# @documind/api — NestJS 11 + Drizzle + pgvector

API del loop de ingesta: upload → OCR con LLM de visión → ficha editable con auditoría por campo → gate de confirmación → embeddings padre+hijos en pgvector. Swagger en `http://localhost:4000/docs`.

## Requisitos

- Node ≥ 22 y pnpm 11 (monorepo con Turborepo).
- Docker Desktop con el compose de la raíz del repo (Postgres 16 + pgvector en el host `:5433`).

## Configuración

```powershell
Copy-Item apps\api\.env.example apps\api\.env   # opcional: la raíz del repo también se lee
```

Se leen, en orden de prioridad: variables ya exportadas en el shell → `apps/api/.env` → `<raíz del repo>/.env`. Claves: `DATABASE_URL`, `PORT`, `OPENROUTER_API_KEY`, `DOCUMIND_FAKE_PROVIDERS`, `UPLOAD_DIR` (ver `.env.example`).

**Modos del provider** (decisión por `DOCUMIND_FAKE_PROVIDERS`):

| Modo | Comportamiento                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1`  | FakeProvider: extracción `SAMPLE_EXTRACTION` + embeddings determinísticos (2048 dims). No toca la red ni la cuota. Tests ✓.                                                            |
| otro | OpenRouter real vía `fetch` (`/chat/completions` con `response_format: json_schema`, `/embeddings`); requiere `OPENROUTER_API_KEY` en el entorno o en `.env`, si no la API no arranca. |

**Prioridad de la API key (M2):** BD (`provider_settings`, cifrada AES-256-GCM con `DOCUMIND_MASTER_KEY`) → env (`OPENROUTER_API_KEY`) → error. La key se guarda por `PUT /settings/provider` y solo se lee en modo real; el fallo de clave maestra aparece al primer uso del provider (no al arrancar).

## Arranque

```powershell
docker compose up -d                                  # Postgres en :5433
docker exec documind-db pg_isready -U documind -d documind
pnpm --filter @documind/api db:migrate                # aplica src/database/migrations/
pnpm --filter @documind/api db:seed                   # model_config: qwen3.8-27b:free · nemotron-3-embed-1b:free (2048)
pnpm --filter @documind/api dev                       # tsx watch → http://localhost:4000/api/v1
```

Verificación rápida: `curl http://localhost:4000/api/v1/health` → `{"status":"ok","db":"up",...}`.

## Scripts

| Script             | Qué hace                                                          |
| ------------------ | ----------------------------------------------------------------- |
| `db:generate`      | drizzle-kit: genera migración SQL desde `src/database/schema.ts`  |
| `db:migrate`       | aplica migraciones contra la BD del compose                       |
| `db:seed`          | inserta los modelos por defecto (idempotente)                     |
| `dev`              | servidor con tsx watch                                            |
| `build` / `start`  | `tsc` → `node dist/main.js`                                       |
| `test`             | vitest: unit (`src/**/*.test.ts`) + e2e (`test/**/*.e2e-spec.ts`) |
| `lint`/`typecheck` | `tsc --noEmit` (ESLint solo existe en la web)                     |

## Tests

`pnpm --filter @documind/api test` requiere el compose arriba. Los e2e arrancan el `AppModule` completo con **FakeProvider** (forzado por `vitest.config.ts`) y terminan con `TRUNCATE` de las tablas — **borran los datos de desarrollo**. En esta máquina (12 GB) corre los gates turbo con `--concurrency=1` y `$env:NODE_OPTIONS="--max-old-space-size=2048"`.

El e2e de la web (`pnpm --filter web e2e`) necesita además la API corriendo en `:4000` con `DOCUMIND_FAKE_PROVIDERS=1`.

## Endpoints M1 (v1)

Base `/api/v1` · errores uniformes `{code, message, details}`:

- `GET /health`
- `POST /documents` (multipart jpg/png/webp/pdf ≤ 20 MB) · `GET /documents` (filtros status/docType/fecha + paginación) · `GET /documents/:id/file` (inline + Range)
- `POST /documents/:id/extract` — OCR síncrono de todas las páginas en una pasada; semáforo de 1 extracción (409 `EXTRACTION_IN_PROGRESS`), cap 8 páginas (422 `TOO_MANY_PAGES`), backoff 429/5xx (502 `LLM_ERROR` + estado `error`)
- `GET /documents/:id/extraction` — `llm_data` en draft, `confirmed_data`+`field_audit` en confirmed
- `PATCH /documents/:id/extraction` — guarda la ficha editada (draft); el servidor recalcula `field_audit` con `diffFields` y registra revisión `draft_edit` solo si hay diff; 409 `EXTRACTION_CONFIRMED` si ya está confirmada
- `POST /documents/:id/confirm` — gate: texto natural del documento + un chunk por ítem → `provider.embed` → transacción (extracción `confirmed` + revisión `confirmed` + chunks + documento `archivado`); re-confirmar 409
- `PATCH /documents/:id/extraction/confirmed` — edición de archivados: recalcula auditoría y **re-embed** transaccional (delete+insert de chunks) con revisión `post_confirm_edit`

## Convenciones del código

- tsx no emite `design:paramtypes`: todo constructor DI usa `@Inject(Clase)` explícito y los factories listan `inject: [TOKEN]`.
- Tokens de DI string: `API_ENV`, `DRIZZLE_DB`, `POOL`, `PROVIDER`.
- Swagger: cada `@ApiProperty` con `type:` explícito, o el doc gen crashea bajo tsx.
- pgvector: HNSW no admite >2000 dims → el índice de `document_chunks` usa `halfvec(2048)` (migración 0000).
- El esquema de filas por tipo de documento vive en `@documind/shared` (`DOC_TYPE_TABLE_SCHEMA`); el JSON Schema del LLM es su espejo en `src/extractions/llm-schema.ts`.
