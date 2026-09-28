# AGENTS.md — Guía para agentes (DocuMind)

## Qué es

Web app RAG de documentos: subir imagen/PDF → OCR con LLM de visión (OpenRouter, tier free) → ficha editable confirmada por humano → embeddings → pgvector → búsqueda/chat con citas (M2). Ver `docs/PRD.md` (v2) y `docs/ARCHITECTURE.md` (v2).

## Estado actual (2026-09-28)

- **Plan activo**: `docs/plans/2026-09-27-m1-ingestion-loop.md` — leerlo PRIMERO. Tasks 1–3 completadas (contratos shared, scaffold NestJS+Drizzle, upload/listing). Pendientes: Task 4 (pipeline OCR) → 5 (ficha editable) → 6 (gate+embeddings) → 7 (cierre).
- Ejecutar con la skill local `executing-plans`, tarea por tarea, marcando checkboxes.
- Commits: Conventional Commits en `main`; PREGUNTAR antes de cada commit.

## Stack y puertos

- Monorepo pnpm 11 + Turborepo. `apps/web` (Next 15, :3000) · `apps/api` (Nest 11, :4000) · `packages/shared` (Zod, contratos).
- Postgres 16 + pgvector: `docker compose up -d` (host :5433, user/pass/db = documind).
- Base URL API: `http://localhost:4000/api/v1` · Swagger: `/docs`.
- Errores uniformes: `{code, message, details}` (el API solo devuelve codes; la web los traduce).

## Runbook

1. `docker compose up -d` → esperar `docker exec documind-db pg_isready -U documind -d documind`
2. `pnpm --filter @documind/api db:migrate && pnpm --filter @documind/api db:seed`
3. API dev: `pnpm --filter @documind/api dev` · Verificación rápida: `curl http://localhost:4000/api/v1/health` → `{"status":"ok","db":"up",...}`
4. Web dev: `pnpm --filter web dev` · e2e web: `pnpm --filter web e2e`
5. Tests API: `pnpm --filter @documind/api test` (requieren la BD del compose arriba)
6. Gates antes de commitear: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` + `pnpm format:check` (Prettier con `endOfLine: auto`).

## Variables (copiar .env.example → .env)

`DATABASE_URL` · `PORT=4000` · `OPENROUTER_API_KEY` (M1: respaldo por env; cifrado en BD es M2) · `DOCUMIND_FAKE_PROVIDERS=1` (providers fake: SAMPLE_EXTRACTION + embeddings determinísticos; NO gasta cuota y es obligatorio en CI/tests).

## Convenciones críticas del código (leer antes de tocar apps/api)

- **tsx NO emite design:paramtypes** → todo constructor DI necesita `@Inject(Clase)` explícito. Los factories usan `inject: [TOKEN]` en el array.
- **DTOs de Swagger**: cada `@ApiProperty` con `type:` explícito (String/Number/Date/clase, `isArray: true`); si no, Swagger crashea explorando bajo tsx.
- Tokens de DI: `API_ENV`, `DRIZZLE_DB`, `POOL`, `PROVIDER` (string tokens, no clases como token).
- Esquema de tabla de ítems: `packages/shared/src/table-schema.ts` (`DOC_TYPE_TABLE_SCHEMA` — columnas por doc_type; filas `Record<string, string|number>`; paths de auditoría planos tipo `items.0.valor_total`). Tipos doc: factura/contrato/recibo/documentacion/propuesta.
- Iconos: SOLO lucide-react. Sin comentarios en código. Textos visibles con i18n (es/en).

## Pitfalls de esta máquina (Windows)

- Docker Desktop: al reiniciar puede quedar un proceso huérfano en el puerto 4000 — `Get-NetTCPConnection -LocalPort 4000` → `Stop-Process` antes de arrancar el dev server.
- RAM 12 GB: `.wslconfig` con `memory=1GB` (ya creado). No arrancar Docker y tsc en paralelo.
- `pnpm-workspace.yaml` tiene `allowBuilds` con `@scarf/scarf: false`.
- pgvector: **HNSW no admite >2000 dims** → el índice usa `halfvec(2048)` (migración 0000).
- `@nestjs/testing` debe ir en v11 (v12 es incompatible con core 11).
- Acentos/BOM: si un archivo se corrompe, reescribirlo y verificar con `node scripts/check-bom.mjs`.
- e2e de web corre contra build de producción (puerto 3101).

## Historial de commits M1

`f2ca97c` plan · `6a03cef` contratos shared v2 · `d24be11` scaffold API · `ecf2665` upload/listing
