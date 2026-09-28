# M1 — Loop de Ingesta (API + OCR + Ficha Editable + Confirmar) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: usa la skill local `executing-plans` para ejecutar este plan tarea por tarea. Steps con checkbox (`- [ ]`).
> **Nota de commits:** cada task termina con su commit semántico (convención Conventional Commits, `main`); preguntar al usuario antes de ejecutar los commits.
> **Update 2026-09-27:** plan verificado contra el estado real del repo tras el hardening web (commits `bc8265a`, `65c348e`, `75aa518` en `main`, ya empujados a `origin`). Decisiones cerradas — ver tabla abajo.

**Goal:** Loop completo de ingesta de extremo a extremo: subir documento → OCR con LLM de visión (Qwen3.8 27B `:free` de OpenRouter) → ficha editable talonario (labels + inputs + grid de ítems) → «CONFIRMAR Y ARCHIVAR» (gate) → embeddings padre+ítems → Postgres+pgvector. Sin chat ni búsqueda (M2).

**Architecture:** Se añade `apps/api` (NestJS 11) al monorepo; persistencia Drizzle + Postgres 16/pgvector (docker-compose, puerto 5433); archivos en disco (`uploads/` en la raíz del repo, fuera de git). La web (Next.js 15, puerto 3000) habla con la API por **proxy rewrite**: `/api/*` → `http://localhost:4000/api/v1` (un solo origen, sin CORS, puerto de la API no expuesto al exterior). La UI de Revisión reemplaza el JSON simulado por la ficha real del documento activo.

**Tech Stack (M1):** NestJS 11 + @nestjs/swagger · Drizzle ORM + drizzle-kit (migraciones SQL) · `pgvector/pgvector:pg16` · `pdf-to-img` (pdf.js + @napi-rs/canvas, binarios precompilados — JS puro sin compilación nativa) · Vitest (unit) + Supertest (e2e endpoints) · provider fakes para embeddings/OCR en tests · adapter del provider vía **`@openrouter/sdk`** (o fetch directo a `https://openrouter.ai/api/v1`, según la doc oficial de OpenRouter — soporte de `usage` y `reasoning` en la respuesta).

**Ref visual:** `docs/DESIGN.md` (tokens «Talonario de facturas», reglas de continuidad) — la ficha editable es un formulario serial con líneas azules y etiquetas uppercase; nada de gradientes ni glass.

---

## Decisiones cerradas (verificadas y aprobadas)

Nota de contratos: extractStructured es síncrono en M1; el contrato con streaming (chatStream) llega en M2 con su implementación real.

| #   | Decisión                                                                                     | Racional                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Ficha completa RAG con humano al centro** (grill 1)                                        | el OCR reconoce el documento completo; el humano corrige y confirma antes de generar embeddings. El grounding del chat (M2) usa confirmed_data exclusivamente |
| 2   | **Auditoría por campo** `field_audit` (grill 2)                                              | diff llm_data vs confirmed_data con paths planos tipo `items.0.valor_unitario`                                                                                |
| 3   | **Embedding padre + chunks hijos `Array<Record<string,string\|number>>` por fila** (grill 3) | Un embedding del documento natural + UNO por ítem de tabla para búsquedas precisas                                                                            |
| 4   | **`DOC_TYPE_TABLE_SCHEMA` en shared** (grill 4)                                              | Columnas declaradas por tipo de documento (`text/number/money`); UI genérica ItemsGrid                                                                        |
| 5   | **Todo editable incl. doc_type** (grill 5)                                                   | Conmutador de tipo en la ficha con prompt (el schema cambia y re-renderiza)                                                                                   |
| 6   | **Re-embed al editar archivados** (grill 6)                                                  | PATCH en `confirmed` actualiza chunks (delete+insert transaccional)                                                                                           |
| 7   | **Ficha por documento** — multi-página agregado en un solo doc (grill 7+1)                   | `document_chunks.kind` = document (padre) o item (hijo, por fila)                                                                                             |
| 8   | **Tope de ~8 páginas por extracción OCR**                                                    | más → error 422 con mensaje claro en es/en                                                                                                                    |
| 9   | **Tabla `extraction_revisions` append-only**                                                 | Cada acción (`created`, `draft_edit`, `confirmed`, `post_confirm_edit`) registra llm_data + confirmed_data + field_audit + actor (llm/humano)                 |
| 10  | **OCR todas las páginas** en una pasada                                                      | los campos raíz se sintetizan de las N páginas como un solo documento                                                                                         |
| 11  | **API key por `.env` en M1** (respaldo)                                                      | pantalla de Configuración con cifrado en BD llega en M2                                                                                                       |
| 12  | **Proxy rewrite Next** `/api/*` → `localhost:4000`                                           | un solo origen (evita CORS)                                                                                                                                   |
| 13  | **Semáforo de 1 extracción en memoria**                                                      | segunda petición recibe HTTP 409 con cuerpo de error uniforme                                                                                                 |

---

## Modelo de datos (v2 — migraciones Drizzle)

- `documents`: id, filename, mime, size_bytes, storage_path, page_count, status (enum document_status: pending, processing, ready_for_review, archivado, error), created_at, updated_at. Índice en (status, created_at).
- `extractions`: id (uuid pk), document_id (fk), doc_type (enum), status (enum extraction_status: draft, confirmed), llm_data JSONB NOT NULL, confirmed_data JSONB nullable, field_audit JSONB nullable (paths planos), confidence REAL, provider/model_id/tokens, created_at/updated_at/confirmed_at.
- `document_chunks`: id, document_id FK cascade, extraction_id FK, kind enum(document,item), item_index int nullable, content text, **embedding vector(2048)** con índice HNSW (cosine); dims de `model_config.embedding` (Nemotron 3 Embed 1B free → 2048).
- `extraction_revisions`: id, extraction_id FK cascade, **action** enum(created, draft_edit, confirmed, post_confirm_edit), actor text, llm_data JSONB, confirmed_data JSONB nullable, field_audit JSONB nullable, created_at. Sin UNIQUE (historial append-only).
- `model_config` / `provider_settings`: seeds OpenRouter — vision/chat `qwen/qwen3.8-27b:free`, embedding `nvidia/nemotron-3-embed-1b:free` (dims 2048).

Enums SQL: `document_status`, `extraction_status`, `doc_type` (5 valores), `chunk_kind`, `revision_action`.

## Endpoints implementados en M1 (subset de ARCHITECTURE §5)

| Método | Ruta                                         | M1                                                                                      |
| ------ | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| GET    | `/api/v1/health`                             | API + BD + modelos con semillas                                                         |
| POST   | `/api/v1/documents`                          | multipart/pdf,jpeg,png,webp; validación Zod + límites; storage_path relativo            |
| GET    | `/api/v1/documents`                          | lista con filtros status/doc_type/fecha (resumen para el historial de la web)           |
| GET    | `/api/v1/documents/:id/file`                 | stream para preview de la ficha                                                         |
| POST   | `/api/v1/documents/:id/extract`              | OCR sync (pdf-to-img → visión LLM), semaphore 1 (409 si ocupado), backoff exp 429/5xx   |
| GET    | `/api/v1/documents/:id/extraction`           | llm_data o confirmed_data según estado                                                  |
| PATCH  | `/api/v1/documents/:id/extraction`           | valida Zod v2 + diff campo a campo → field_audit + revision `draft_edit`                |
| POST   | `/api/v1/documents/:id/confirm`              | gate: `confirmed_data` final → texto natural → embeddings → chunks → status `archivado` |
| PATCH  | `/api/v1/documents/:id/extraction/confirmed` | edición de archivado → revision `post_confirm_edit` → re-embed transaccional            |

Deferidos: `/search` y `/chat` (M2), `/settings/*` UI (M2; el modelo se setea por seeds/env).

## Contratos mock en M1 (para pruebas sin coste)

- Un flag `DOCUMIND_FAKE_PROVIDERS=1` inyecta providers fake (SAMPLE_EXTRACTION + embeddings determinísticos) para desarrollo y CI sin consumir la cuota de OpenRouter.
- En producción y en la verificación manual del cierre se usa el provider real.

---

## Estructura de archivos que este plan crea

```
docker-compose.yml                        (sin cambios — ya con pgvector en 5433)
apps/api/drizzle.config.ts                (drizzle-kit migrations; pnpm --filter api db:migrate)
apps/api/                                 (NestJS)
  src/{main.ts,app.module.ts}
  src/config/{env.validation.ts,db.ts}
  src/common/{error.filter.ts,pagination.ts,semaphore.ts}
  src/documents/{documents.module,controller,service}.ts
  src/extractions/{extractions.controller.ts,extractions.service.ts,pipeline.ts,pdf-renderer.ts,provider.factory.ts,embed.ts,natural-text.ts}
  src/settings/{settings.module.ts,service.ts}         (lectura de model_config seeds)
  src/database/{schema.ts,migrations/*.ts,seed.ts}
  test/{app.e2e-spec.ts,utils/db-test.ts,fixtures/*.png,*.pdf}
packages/shared/
  src/table-schema.ts                     (DOC_TYPE_TABLE_SCHEMA + helpers)
  src/extraction.ts                       (v2: items rows + field_audit paths + revisions + states)
  src/llm.ts                              (ampliado: addChatStream placeholder + listModels purpose chat)
  src/audit.ts                            (diff plana de auditoría por campo, test unit)
apps/web/src/app/[locale]/review/page.tsx (ficha real: consume la API v1)
apps/web/src/components/{ficha-form.tsx,items-grid.tsx,doc-type-switcher.tsx,items-total-alert.tsx}
apps/web/src/lib/api.ts                   (fetch wrapper /api/v1)
apps/web/src/messages/{es,en}.json
apps/web/e2e/ingesta.spec.ts              (flujo completo mockeado)
```

---

### Task 1: Contratos en shared (M1.0)

**Files:** `packages/shared/src/{table-schema.ts,audit.ts,extraction.ts,llm.ts,index.ts}` + tests

- [x] **S1:** `table-schema.ts` — `TableColumnType = "text" | "number" | "money"`, `TableSchema`, `DOC_TYPE_TABLE_SCHEMA: Record<DocType, TableSchema[]>` con las columnas por tipo de documento (factura: descripción/cantidad/valor_unitario/valor_total; propuesta: rubros con concepto/valor; recibo: concepto/valor; contrato y documentación: `[]`). Helpers: `getTablesForDocType`, `emptyRowFor(schema)`.
- [x] **S2:** `extraction.ts` v2 — `extractionResultSchema` ampliada con `items` (array de records según schema) + `items_total` (string money en la raíz) — **el JSON schema derivado del Zod se pasa al LLM**. Estados: `documentStatus` (pending/processing/ready_for_review/archivado/error) y `extractionStatus` (draft/confirmed). Validador de llm_data que normaliza filas de items a strings.
- [x] **S3:** `audit.ts` — `diffFields(llmData, confirmedData)` → `field_audit` (paths planos; deep diff para objetos anidados de items; item añadido/borrado genera entrada). Test unitario con 6+ casos (campo raíz, celda de items, ítem añadido, ítem borrado, sin cambios, tipos number/money).
- [x] **S4:** `llm.ts` — ampliar `listModels(purpose: "vision" | "embedding" | "chat")`; añadir `embed(inputs: string[], opts?: {dimensions?: number})`; placeholder `chatStream` en el contrato con lanzamiento de "not implemented in M1" para que el tipo compile (implementación real en M2). Añadir cost/params para OpenRouter además de vision.
- [ ] **S5:** Gates: `pnpm --filter shared test && pnpm typecheck & lint` en verde; commit
      `feat: shared contract v2 with table schema, audit diff and provider updates`

### Task 2: Scaffold API NestJS + Drizzle (M1.1)

**Files:** `apps/api/*` (main, config, módulos base), `src/database/{schema.ts,migrations}`, seeds, health, error filter uniforme

- [x] **S1:** Crear `apps/api` con NestJS 11 — Express default (compatibilidad con @nestjs/swagger y multer). Puerto **4000**. Prefijo global `/api/v1`. `ValidationPipe` global (whitelist + transform) + `@nestjs/swagger` en `/docs` + `class-validator` DTOs que re-disponen schemas de `@documind/shared` donde aplique.
- [x] **S2:** Drizzle: `src/database/schema.ts` (tablas del §Modelo de datos — pgvector via `drizzle-orm/pg-core` + `vector` importado de `drizzle-orm`). drizzle-kit `migrate` con `drizzle.config.ts` (dialect postgresql, DATABASE_URL al compose 5433) — script `pnpm --filter api db:migrate`. Seeds de `model_config` con los 3 modelos free.
- [x] **S3:** Env validation (zod): `DATABASE_URL`, `PORT=4000`, `OPENROUTER_API_KEY` opcional en M1. `.env.example` actualizado.
- [x] **S4:** Error filter uniforme: `{code, message, details}` con logging nest pino. `GET /health` responde `{status:'ok', db:'up', models: {vision, embedding, chat}}` (models leídos de seeds).
- [x] **S5:** Health con BD real conectada (compose up) manual check + commit `feat: nestjs api scaffold with drizzle migrations and model seeds`.

### Task 3: Upload + storage + historial (M1.2)

**Files:** `src/documents/*` (controller, service, glob storage)

- [x] **S1:** `POST /documents` con multer (diskStorage a `uploads/{yyyy-mm}/{uuid}.{ext}`): valida mime real (pdf/png/jpg/webp), límites 20 MB, page_count del pdf se calcula después (lazy). Zod valida multipart fields. → `201 {id, filename, status:'pending'}` + row en DB.
- [x] **S2:** `GET /documents/:id/file` (stream con `Content-Type` + `Content-Disposition: inline` + soporte de `Range` para PDF preview). `GET /documents` con filtros básicos (status, docType, fecha) + paginación cursor por id.
- [x] **S3:** Supertest suite de documents (upload válidos/inválidos, file stream, paginación) contra BD de test (compose). commit `feat: document upload with disk storage, preview stream and listing`.

### Task 4: Pipeline OCR (M1.3)

**Files:** `src/extractions/{pipeline.ts,pdf-renderer.ts,provider.factory.ts,embed.ts}`

- [ ] **S1:** `pdf-renderer.ts` con `pdf-to-img` (todas las páginas, cap 8 → si más, lanza error de negocio 422 con mensaje i18n).
- [ ] **S2:** `provider.factory.ts`: adapter `OpenRouterProvider` vía **`@openrouter/sdk`** (o fetch directo a `https://openrouter.ai/api/v1` según doc oficial; ver ARCHITECTURE §7). `extractStructured` requiere imagen(es) dataURLs + JSON Schema de Zod v2; registra tokens. Backoff exponencial 429/500 (Jitter, máximo 5 reintentos). API key desde env (decisión 11). MapError a errores de negocio 502 con cuerpo uniforme.
- [ ] **S3:** `pipeline.ts` (semáforo en memoria, decision 13): `POST /documents/:id/extract` → status processing → render → provider → parse+validate llm_data (Zod) → insert extractions (draft, llm_data) + revision `created` (actor llm) → status ready_for_review. Si el doc ya tenía una extracción, re-extract la reemplaza y registra una nueva revisión `created`.
- [ ] **S4:** Tests unitarios del pipeline con **fake providers** (OCR fake que devuelve SAMPLE, embeddings fake matriz determinística) — sin llamadas reales. Backoff test con server que devuelve 429 dos veces y 200. commit `feat: ocr pipeline with pdf rendering, openrouter adapter and extraction semaphore`.

### Task 5: Ficha editable (M1.4)

**Files:** `apps/web/src/app/[locale]/review/page.tsx` (rewrite), `components/{ficha-form.tsx,items-grid.tsx,doc-type-switcher.tsx,items-total-alert.tsx}`, `lib/api.ts`, messages es/en

- [ ] **S1:** Revisión real: documentPreview (ya existe) + la ficha nueva en el panel derecho. `GET /api/v1/documents/:id/extraction` → si no hay, estado vacío «EXTRAER DATOS» (botón que llama a extract y hace polling). GET del file reescrito al proxy `/api/v1/documents/:id/file`.
- [ ] **S2:** `doc-type-switcher.tsx`: dropdown estilizado talonario; cambiar doc_type re-renderiza la ficha según `DOC_TYPE_TABLE_SCHEMA`.
- [ ] **S3:** `ficha-form.tsx`: labels uppercase (talonario) + inputs con líneas azules (Patrones de docs/DESIGN.md). Campos planos (raíz del JSON) por doc_type: emisor, receptor/destinatario, número, fecha, subtotal, impuestos, total (+ contrato: objeto/partes/fechas/valor; propuesta: alcance/entidad/vigencia/valor; documentación: entidades/fecha/referencia/asunto/contenido). Grid de ItemsGrid vía schema; filas añadir/borrar; validación numérica.
- [ ] **S4:** `items-total-alert.tsx`: banner de discrepancia si suma calculada de filas ≠ items_total parseado (no bloquea: sólo mensaje ámbar).
- [ ] **S5:** PATCH draft con debounce 800ms; diff auditoría por campo cuando diff ≠ "" (S3 de Task 1 serializado en el payload PATCH: `{changes: field_audit}` — el servidor recalcula y guarda).
- [ ] **S6:** e2e Playwright (flujo completo con API real + provider fake vía flag `DOCUMIND_FAKE_PROVIDERS=1` en un perfil de test): upload → extract → editar → confirmar → reaparece ARCHIVADO en historial. commit `feat: editable ficha with items grid, audit-friendly patch and confirm gate`.

### Task 6: Gate confirmar + embeddings + re-embed (M1.5)

**Files:** `src/extractions/{embed.ts,natural-text.ts}` + PATCH confirmed

- [ ] **S1:** `natural-text.ts`: generadores de texto natural por doc_type (documento padre) y por ítem (chunk hijo «Ítem 3: descripción…, cantidad…»).
- [ ] **S2:** `POST /documents/:id/confirm`: valida llm_data/confirmed_data → genera textos → `provider.embed([docText, ...items, ...])` → inserta padre (kind=document) + hijos (kind=item, item_index) → status rchivado + confirmed_at. Transaccional. Estados y tokens guardados. Idempotente si se vuelve a confirmar (409).
- [ ] **S3:** PATCH en confirmed → re-embed transaccional (delete+insert de chunks de ese documento) + revisión `post_confirm_edit` (actor humano).
- [ ] **S4:** Tests con fake embed provider: los chunks insertados coinciden con nº de filas+1 y textos correctos; re-embed reemplaza los anteriores. commit `feat: confirm gate with parent-child embeddings and re-embed on archivado edit`.

### Task 7: Cierre M1 (M1.6)

**Files:** README apps/api, ARCHITECTURE.md (añadir tabla extraction_revisions + decisiones proxy/semáforo/env-key), docs/PRD (actualizar estado de criterios de aceptación cubiertos por M1)

- [ ] **S1:** README apps/api con instrucciones (compose up, migrate, seed, dev, test, DOCUMIND_FAKE_PROVIDERS).
- [ ] **S2:** Actualizar ARCHITECTURE.md §4-6 con las decisiones cerradas 2026-09-27 (tabla revisions, proxy rewrite, semáforo, env key, DOC_TYPE_TABLE_SHAPE).
- [ ] **S3:** Verificación manual end-to-end con OpenRouter real: subir PDF → OCR → editar → confirmar → consultar `document_chunks` con rows correctos en pgvector (scripts/verify-embeddings.ts con búsqueda de prueba usando embeddings fake… o consultas de conteo).
- [ ] **S4:** Gates completos: typecheck + lint + test (shared, web, api) + build + e2e Playwright. commit `docs: close M1 with verify instructions and architecture updates`.

---

## Fuera de alcance de M1

- Chat con citas y búsqueda semántica (M2) · Pantalla de Configuración y cifrado de API key (M2) · provider real de embeddings con coste · autenticación multi-usuario (M3+ si aplica) · cola persistente de extracciones (semáforo en memoria es suficiente para uso personal) · uploads S3 (disco local).

## Riesgos y mitigaciones

| Riesgo                                                     | Mitigación                                                                                                                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qwen3.8 27B free devuelve JSON malformado o alucina campos | Zod estricto tras el LLM + sanity check de totales; si falla el parse, retry 1 con prompt de corrección; si persiste → error 502 con detalle y la ficha queda en estado error |
| Rate limits del tier free (429)                            | Backoff exponencial con jitter (máx 5 intentos); semáforo 1; el usuario ve estado processing con spinner talonario                                                            |
| pgvector HNSW vs IVFFlat                                   | HNSW no requiere entrenamiento previo y funciona bien a 2048 dims; si surgen problemas, cambiar a IVFFlat lists=100                                                           |
| pdf-to-img en Windows                                      | binarios precompilados de @napi-rs/canvas; verificación en Task 4 S1 con PDF fixture real                                                                                     |
| drift entre schemas shared y DTOs Nest                     | Los DTOs re-disponen de Zod de shared; no duplicar validación manual                                                                                                          |

---

**Referencias:** `docs/ARCHITECTURE.md` §4-8 (modelo, API, pipeline) · `docs/PRD.md` (US2.1-US3.2, RNF1) · `docs/DESIGN.md` (tokens talonario) · decisiones grill 2026-09-26 y verificaciones 2026-09-27.
