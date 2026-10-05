# AGENTS.md — Guía para agentes (DocuMind)

## Qué es

Web app RAG de documentos: subir imagen/PDF → OCR con LLM de visión (OpenRouter, tier free) → ficha editable confirmada por humano → embeddings → pgvector → búsqueda/chat con citas (M2). Ver `docs/PRD.md` (v2) y `docs/ARCHITECTURE.md` (v2).

## Estado actual (2026-10-04) — **M1 y M2 CERRADOS** ✅

- **Plan M1**: `docs/plans/2026-09-27-m1-ingestion-loop.md` — Tasks 1–7 completadas. Loop real verificado end-to-end con OpenRouter (OCR 7.1 s/1 página · embeddings Nemotron reales 2048 dims · cosine ok).
- **Plan M2**: `docs/plans/2026-10-03-m2-recovery.md` — Task 0 (spike SSE: OK; el buffering del proxy se resolvió con `compress: false` en `apps/web/next.config.ts`) y Tasks 1–8 completadas. Verificado con OpenRouter real: `/search` kNN halfvec (Nemotron real), `/chat` grounded por SSE con citas híbridas `[n]` parseadas y fallback, key cifrada AES-256-GCM en BD (prioridad BD > env > fake, `DOCUMIND_MASTER_KEY`). Siguiente milestone: **M3** (archivo) — requiere plan nuevo con `writing-plans`.
- Última sesión (Task 7): dotenv unificado (`main.ts` + `migrate`/`seed` leen `apps/api/.env` y luego el de la raíz del repo; las vars ya exportadas ganan), `apps/api/.env.example` y `apps/api/README.md` nuevos, migración 0001 (UNIQUE `model_config(provider,purpose)` + dedup — antes `db:seed` duplicaba filas), ARCHITECTURE.md v2.1 y PRD v2.1 alineados con lo construido.
- API: pipeline OCR con semáforo(409) + cap 8 páginas(422) + backoff, PATCH draft con `field_audit` servidor, gate `POST /confirm` (chunks padre+hijos + `archivado`), `PATCH /extraction/confirmed` con re-embed, revisiones `created/draft_edit/confirmed/post_confirm_edit`.
- M2 API: `POST /search` (kNN halfvec 2048, dedup por documento, padre siempre acompaña con `similarity: null`, `tookMs`), `POST /chat` SSE (deltas → evento `citations` con `messageId`/`sessionId`; historial persistido en `chat_messages`, últimos 8 al prompt; citas híbridas con fallback), `GET /documents/:id` (deep-links), `GET/PUT /settings/provider` (cifrado AES-256-GCM con `DOCUMIND_MASTER_KEY`, solo hint al frontend) y `GET/PUT /settings/models` (catálogo real filtrado `listModels`, upsert respeta UNIQUE 0001). Módulo nuevo `ProvidersModule` (factoría `PROVIDER` compartida); `SettingsApiModule` aloja el controller de settings (evita ciclo).
- M2 Web: páginas `/search`, `/chat` y `/settings` talonario + `nav-links.tsx` (SUBIR/BÚSQUEDA/CHAT/AJUSTES), `lib/sse.ts`(`readSse`), `lib/highlight.ts`, `lib/chat-store.ts` (zustand), key en BD con prioridad BD > env > fake.
- Web UI: `ficha-form`/`items-grid`/`doc-type-switcher`/`items-total-alert`/`history-list` + `lib/api.ts` (proxy `/api/*`→`:4000/api/v1`) + helpers `lib/ficha.ts` + botón CONFIRMAR Y ARCHIVAR. La hoja carbón M0 (`extraction-sheet`, `json-highlight`) fue eliminada (decisión usuario).
- Ejecutar con la skill local `executing-plans`, tarea por tarea, marcando checkboxes.
- Commits: Conventional Commits en `main`; PREGUNTAR antes de cada commit/push.

## Stack y puertos

- Monorepo pnpm 11 + Turborepo (Node ≥ 22). `apps/web` (Next 15, :3000) · `apps/api` (Nest 11, :4000) · `packages/shared` (Zod, contratos). Filtros pnpm: `web` (sin scope) pero `@documind/api` y `@documind/shared`.
- Postgres 16 + pgvector: `docker compose up -d` (host :5433, user/pass/db = documind).
- Base URL API: `http://localhost:4000/api/v1` · Swagger: `/docs`.
- Errores uniformes: `{code, message, details}` (el API solo devuelve codes; la web los traduce).

## Runbook

1. `docker compose up -d` → esperar `docker exec documind-db pg_isready -U documind -d documind`
2. `pnpm --filter @documind/api db:migrate && pnpm --filter @documind/api db:seed`
3. API dev: `pnpm --filter @documind/api dev` · Verificación rápida: `curl http://localhost:4000/api/v1/health` → `{"status":"ok","db":"up",...}`
4. Web dev: `pnpm --filter web dev` · e2e web: `pnpm --filter web e2e`
5. Tests API: `pnpm --filter @documind/api test` (requieren la BD del compose; los e2e en `apps/api/test/*.e2e-spec.ts` arrancan el AppModule completo y hacen TRUNCATE de las tablas — borran datos de dev).
6. Gates antes de commitear: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` + `pnpm format:check` (Prettier con `endOfLine: auto`). En esta máquina (12 GB): correr como `pnpm exec turbo run typecheck lint test build --concurrency=1` con `$env:NODE_OPTIONS="--max-old-space-size=2048"` — en paralelo o sin tope de heap los workers OOM (crash nativo 0xC0000409 en `next build`).
7. Git hooks versionados: en un clon fresco hacer `git config core.hooksPath .githooks` o el pre-commit no corre (BOM check + `prettier -c .`).

## Migraciones

- Editar `apps/api/src/database/schema.ts` → `pnpm --filter @documind/api db:generate` → revisar el SQL generado en `src/database/migrations/` → `db:migrate`. `db:generate` es codegen (drizzle-kit); `db:migrate` aplica contra la BD del compose.
- pgvector: **HNSW no admite >2000 dims** → el índice usa `halfvec(2048)` (migración 0000).

## Variables

La API carga `.env` automáticamente (en orden de prioridad: exports del shell → `apps/api/.env` → `.env` de la raíz del repo). Copiar `apps/api/.env.example` → `.env` donde se prefiera.

`DATABASE_URL` (default compose :5433) · `PORT=4000` · `OPENROUTER_API_KEY` (modo real; respaldo si la BD no tiene key cifrada; sin ella y sin flag fake, la API no arranca) · `DOCUMIND_FAKE_PROVIDERS=1` (providers fake: SAMPLE_EXTRACTION + embeddings determinísticos; NO gasta cuota; los tests de API lo fuerzan vía `vitest.config.ts` y es obligatorio en CI) · `DOCUMIND_MASTER_KEY` (hex 64; exige+/cifra la key en BD por `PUT /settings/provider`; solo obligatoria al guardar) · `UPLOAD_DIR` (default `uploads/` **relativo al cwd** — con pnpm filters queda en `apps/api/uploads`; datos runtime, fuera de git) · `API_PROXY_URL` (proxy de Next, default `http://localhost:4000/api/v1`).

## Convenciones críticas del código (leer antes de tocar apps/api)

- **tsx NO emite design:paramtypes** → todo constructor DI necesita `@Inject(Clase)` explícito. Los factories usan `inject: [TOKEN]` en el array.
- **DTOs de Swagger**: cada `@ApiProperty` con `type:` explícito (String/Number/Date/clase, `isArray: true`); si no, Swagger crashea explorando bajo tsx.
- Tokens de DI: `API_ENV`, `DRIZZLE_DB`, `POOL`, `PROVIDER` (string tokens, no clases como token).
- Esquema de tabla de ítems: `packages/shared/src/table-schema.ts` (`DOC_TYPE_TABLE_SCHEMA` — columnas por doc_type; filas `Record<string, string|number>`; paths de auditoría planos tipo `items.0.valor_total`). Tipos doc: factura/contrato/recibo/documentacion/propuesta.
- `lint` en api y shared es `tsc --noEmit` (ESLint solo existe en web).
- Iconos: SOLO lucide-react. Sin comentarios en código. Textos visibles con i18n (es/en, `apps/web/src/messages/`).

## Pitfalls de esta máquina (Windows)

- Docker Desktop: al reiniciar puede quedar un proceso huérfano en el puerto 4000 — `Get-NetTCPConnection -LocalPort 4000` → `Stop-Process` antes de arrancar el dev server.
- RAM 12 GB: `.wslconfig` con `memory=1GB` (ya creado). No arrancar Docker y tsc en paralelo.
- `pnpm-workspace.yaml` tiene `allowBuilds` (`@scarf/scarf: false`; swc/esbuild/watcher sí compilan).
- `@nestjs/testing` debe ir en v11 (v12 es incompatible con core 11).
- Acentos/BOM: si un archivo se corrompe, reescribirlo y verificar con `node scripts/check-bom.mjs` (lo corre el pre-commit).
- `pdf-to-img` v7 es ESM-only: importarlo SOLO con `await import("pdf-to-img")` dinámico (funciona en tsx/CJS por require(esm) de Node 22+).
- e2e de web corre contra build de producción (puerto 3101, `reuseExistingServer`).
