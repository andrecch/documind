# AGENTS.md — Guía para agentes (DocuMind)

## Qué es

Web app RAG de documentos: subir imagen/PDF → OCR con LLM de visión (OpenRouter, tier free) → ficha editable confirmada por humano → embeddings → pgvector → búsqueda/chat con citas (M2). Ver `docs/PRD.md` (v2) y `docs/ARCHITECTURE.md` (v2).

## Estado actual (2026-10-01)

- **Plan activo**: `docs/plans/2026-09-27-m1-ingestion-loop.md` — leerlo PRIMERO. Tasks 1–5 completadas (contratos shared, scaffold NestJS+Drizzle, upload/listing, pipeline OCR con semáforo + adapter OpenRouter fetch + FakeProvider, ficha editable web + PATCH draft con field_audit servidor). Pendientes: Task 6 (gate+embeddings) → 7 (cierre).
- Task 5 añadió: PATCH `/documents/:id/extraction` (409 `EXTRACTION_CONFIRMED` en confirmed — edición de archivados es Task 6), proxy rewrite Next `/api/*`, `lib/api.ts` web, historial mínimo en home, campos raíz por doc_type en `extractionResultSchema` (objeto/partes/fechas/valor · alcance/entidad/vigencia/valor · entidades/referencia/asunto/contenido).
- OJO Task 6: el e2e «confirmar → ARCHIVADO en historial» prometido en Task 5 S6 se mueve al e2e de Task 6 (el gate POST /confirm no existía).
- OJO Task 6: `PATCH /documents/:id/extraction/confirmed` (re-embed transaccional + revisión `post_confirm_edit`) aún no existe; `items_total` y suma de filas ya tienen alerta en web.
- Ejecutar con la skill local `executing-plans`, tarea por tarea, marcando checkboxes.
- Commits: Conventional Commits en `main`; PREGUNTAR antes de cada commit.

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

## Variables (copiar .env.example → .env)

`DATABASE_URL` · `PORT=4000` · `OPENROUTER_API_KEY` (M1: respaldo por env; cifrado en BD es M2) · `DOCUMIND_PROVIDER` · `DOCUMIND_MASTER_KEY` (AES-256-GCM, se genera con la receta del comentario en .env.example) · `DOCUMIND_FAKE_PROVIDERS=1` (providers fake: SAMPLE_EXTRACTION + embeddings determinísticos; NO gasta cuota y es obligatorio en CI/tests) · `UPLOAD_DIR` (default `uploads/` en la raíz del repo — datos runtime, fuera de git).

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
