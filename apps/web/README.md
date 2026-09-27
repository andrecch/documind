# DocuMind — apps/web

UI de DocuMind (Next.js 15, App Router) en el mundo visual «Talonario».

## Desarrollo

```bash
pnpm install
docker compose up -d db   # Postgres 16 + pgvector (puerto 5433)
pnpm --filter web dev     # http://localhost:3000 → /es
```

## Scripts

| Comando                                | Qué hace                                                |
| -------------------------------------- | ------------------------------------------------------- |
| `pnpm --filter web dev`                | Dev server (Turbopack)                                  |
| `pnpm --filter web build`              | Build de producción                                     |
| `pnpm --filter web test`               | Tests unitarios (Vitest)                                |
| `pnpm --filter web e2e`                | E2E Playwright contra build de producción (puerto 3101) |
| `pnpm --filter web e2e:install`        | Instalar Chromium de Playwright (una vez)               |
| `pnpm --filter web lint` / `typecheck` | Gates                                                   |

## Convenciones

- Todo texto visible pasa por `src/messages/{es,en.json}` (next-intl, `es` por defecto).
- El preview de documentos usa `<img>` a propósito: los `blob:` URLs de archivos locales no pasan por el optimizador de `next/image`.
- Hooks de git versionados: `git config core.hooksPath .githooks` (verifican BOM + formato Prettier).
