# M0 — UI Inicial (Scaffold + Upload + Revisión) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: usa la skill local `executing-plans` para ejecutar este plan tarea por tarea. Steps con checkbox (`- [ ]`).
> **Nota de commits:** cada task tiene su paso de commit; si ejecutas en esta sesión, confirma con el usuario antes de ejecutarlos (regla del proyecto).

**Goal:** Scaffold del monorepo + infraestructura Docker (Postgres/pgvector) + pantallas «Subir» (drag & drop clickeable) y «Revisión» (preview + JSON) en Dark Aurora, con i18n es/en y tema dark/light. Sin integración LLM.

**Architecture:** Monorepo pnpm/Turborepo; `apps/web` (Next.js 15 App Router) consume `@documind/shared` (Zod: tipos de documento, validación de archivos, resultado de extracción). El documento subido vive en memoria (zustand) y la navegación `/ → /review` es cliente. Docker Compose levanta `pgvector/pgvector:pg16` para las fases M1/M2.

**Tech Stack:** pnpm 10 · Turborepo 2 · Next.js 15 + React 19 · TypeScript strict · Tailwind v4 (tokens CSS) · next-intl · next-themes · zustand · react-dropzone · pdfjs-dist@4 · Vitest · Playwright · Docker Compose (Postgres 16 + pgvector).

**Ref visual:** `docs/DESIGN.md` (tokens) y artboards OpenPencil «C1/C2 · Dark aurora».

---

## Estructura de archivos que este plan crea

```
package.json, pnpm-workspace.yaml, turbo.json, docker-compose.yml, .env.example
packages/shared/{package.json,tsconfig.json,vitest.config.ts}
packages/shared/src/{index.ts,document-types.ts,file-validation.ts,extraction.ts,llm.ts}
packages/shared/src/*.test.ts
apps/web/ (create-next-app)
apps/web/src/i18n/{routing.ts,request.ts,navigation.ts}
apps/web/src/messages/{es.json,en.json}
apps/web/src/app/[locale]/{layout.tsx,page.tsx,review/page.tsx}
apps/web/src/components/{navbar.tsx,upload-dropzone.tsx,document-preview.tsx,json-panel.tsx,theme-toggle.tsx}
apps/web/src/lib/store.ts
apps/web/src/styles/sheet: globals.css (tokens)
apps/web/e2e/{upload.spec.ts,fixtures/sample.png}
apps/web/playwright.config.ts
```

---

### Task 1: Scaffold del monorepo

**Files:** Create `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `docs/plans/` (ya existe)

- [ ] **Step 1: Raíz del workspace** — crear `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 2:** crear `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**", "dist/**"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": {},
    "e2e": {},
    "dev": { "cache": false, "persistent": true }
  }
}
```

- [ ] **Step 3:** crear `package.json` raíz:

```json
{
  "name": "documind",
  "private": true,
  "packageManager": "pnpm@10.15.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "e2e": "turbo e2e"
  },
  "devDependencies": { "turbo": "^2.5.0" }
}
```

- [ ] **Step 4:** añadir a `.gitignore` (append): `.turbo`, `.next`, `dist`, `coverage`, `test-results`, `playwright-report`, `uploads`.

```powershell
Add-Content .gitignore "`n.turbo`n.next`ndist`ncoverage`ntest-results`nplaywright-report`nuploads"
```

- [ ] **Step 5:** instalar y verificar: `pnpm install` (crea lockfile). Comando de verificación: `pnpm exec turbo --version` → imprime versión 2.x.

- [ ] **Step 6: Commit** `chore: scaffold pnpm+turbo monorepo`

### Task 2: Docker Compose — PostgreSQL 16 + pgvector

**Files:** Create `docker-compose.yml`, `.env.example`

- [ ] **Step 1:** crear `docker-compose.yml`:

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: documind-db
    environment:
      POSTGRES_USER: documind
      POSTGRES_PASSWORD: documind
      POSTGRES_DB: documind
    ports:
      - "5433:5432"
    volumes:
      - documind_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U documind -d documind"]
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  documind_pgdata:
```

- [ ] **Step 2:** crear `.env.example`:

```bash
# DocuMind — copiar a .env
# API (M1/M2)
DATABASE_URL=postgres://documind:documind@localhost:5433/documind
# Clave maestra de cifrado AES-256-GCM (32 bytes base64): pnpm exec node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
DOCUMIND_MASTER_KEY=
# LLM (respaldo; la fuente de verdad es la BD vía pantalla de Configuración)
DOCUMIND_PROVIDER=openrouter
```

- [ ] **Step 3: Verificar** — `docker compose up -d`; esperar healthy; luego:

```powershell
docker exec documind-db psql -U documind -d documind -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extname FROM pg_extension WHERE extname = 'vector';"
```
Esperado: una fila con `vector`.

- [ ] **Step 4: Commit** `chore: add postgres+pgvector docker compose`

### Task 3: packages/shared — esquemas Zod y validación

**Files:** Create `packages/shared/**`

- [ ] **Step 1:** `packages/shared/package.json`:

```json
{
  "name": "@documind/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^3.24.0" },
  "devDependencies": { "typescript": "^5.7.0", "vitest": "^3.0.0" }
}
```

- [ ] **Step 2:** `packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true, "target": "ES2022", "module": "ESNext",
    "moduleResolution": "bundler", "skipLibCheck": true, "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3:** escribir los tests primero — `packages/shared/src/file-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, validateFile } from "./file-validation";
import { extractionResultSchema, SAMPLE_EXTRACTION } from "./extraction";
import { DOCUMENT_TYPES } from "./document-types";

describe("validateFile", () => {
  it("acepta image/png dentro del límite", () => {
    expect(validateFile({ type: "image/png", size: 1024 })).toEqual({ ok: true, error: null });
  });
  it("rechaza tipos no admitidos", () => {
    expect(validateFile({ type: "application/zip", size: 10 })).toEqual({ ok: false, error: "unsupported-type" });
  });
  it("rechaza archivos mayores a 20 MB", () => {
    expect(validateFile({ type: "application/pdf", size: MAX_FILE_SIZE_BYTES + 1 }))
      .toEqual({ ok: false, error: "file-too-large" });
  });
  it("declara los 4 MIME permitidos", () => {
    expect([...ACCEPTED_MIME_TYPES]).toEqual(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  });
});

describe("extractionResultSchema", () => {
  it("parsea la extracción de muestra", () => {
    expect(extractionResultSchema.parse(SAMPLE_EXTRACTION).tipo_documento).toBe("factura");
  });
  it("rechaza un tipo de documento desconocido", () => {
    expect(extractionResultSchema.safeParse({ tipo_documento: "tomografia" }).success).toBe(false);
  });
  it("valida confianza entre 0 y 1", () => {
    expect(extractionResultSchema.safeParse({ tipo_documento: "factura", confianza: 1.2 }).success).toBe(false);
  });
  it("tiene los 5 tipos de documento", () => {
    expect([...DOCUMENT_TYPES]).toEqual(["factura", "contrato", "recibo", "documentacion", "propuesta"]);
  });
});
```

- [ ] **Step 4:** crear el package (deps) y correr tests para verlos FALLAR:

```powershell
pnpm install
pnpm --filter @documind/shared test
```
Esperado: FAIL — no existe `./file-validation`.

- [ ] **Step 5:** implementación mínima.

`packages/shared/src/document-types.ts`:
```ts
export const DOCUMENT_TYPES = ["factura", "contrato", "recibo", "documentacion", "propuesta"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
```

`packages/shared/src/file-validation.ts`:
```ts
import { z } from "zod";
import { DOCUMENT_TYPES } from "./document-types";

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export type FileValidationError = "unsupported-type" | "file-too-large";

export function validateFile(file: { type: string; size: number }):
  { ok: true; error: null } | { ok: false; error: FileValidationError } {
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) return { ok: false, error: "unsupported-type" };
  if (file.size > MAX_FILE_SIZE_BYTES) return { ok: false, error: "file-too-large" };
  return { ok: true, error: null };
}
```

`packages/shared/src/extraction.ts`:
```ts
import { z } from "zod";
import { documentTypeSchema } from "./file-validation";

export const extractionResultSchema = z.object({
  tipo_documento: documentTypeSchema,
  numero: z.string().optional(),
  fecha_emision: z.string().optional(),
  emisor: z.object({ nombre: z.string().optional(), identificacion: z.string().optional() }).optional(),
  receptor: z.object({ nombre: z.string().optional(), identificacion: z.string().optional() }).optional(),
  moneda: z.string().length(3).optional(),
  subtotal: z.number().optional(),
  impuestos: z.number().optional(),
  total: z.number().optional(),
  items: z.array(z.object({
    concepto: z.string(),
    cantidad: z.number().optional(),
    valor: z.number().optional(),
  })).optional(),
  confianza: z.number().min(0).max(1),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export const SAMPLE_EXTRACTION: ExtractionResult = {
  tipo_documento: "factura",
  numero: "FAC-2026-0847",
  fecha_emision: "2026-09-12",
  emisor: { nombre: "Suministros Andinos S.A.", identificacion: "901.245.678-1" },
  receptor: { nombre: "Constructora Delta Ltda." },
  moneda: "COP",
  subtotal: 2450000,
  impuestos: 465500,
  total: 2915500,
  items: [
    { concepto: "Instalación eléctrica", cantidad: 1, valor: 890000 },
    { concepto: "Materiales", cantidad: 12, valor: 130000 },
  ],
  confianza: 0.97,
};
```

`packages/shared/src/llm.ts` (contrato para M1/M2 — se compila, no se usa aún):
```ts
export type ProviderModel = { id: string; label: string; free: boolean; contextLength?: number };
export type VisionInput = { imageBase64: string; mimeType: string } | { pdfBase64: string };

export interface LLMProvider {
  readonly id: string;
  extractStructured(input: VisionInput, jsonSchema: object): Promise<{
    raw: unknown; modelId: string; tokens: { prompt: number; completion: number };
  }>;
  embed(inputs: string[]): Promise<number[][]>;
  listModels(purpose: "vision" | "embedding", opts?: { freeOnly?: boolean }): Promise<ProviderModel[]>;
}
```

`packages/shared/src/index.ts`:
```ts
export * from "./document-types";
export * from "./file-validation";
export * from "./extraction";
export * from "./llm";
```

- [ ] **Step 6:** correr tests: `pnpm --filter @documind/shared test` → **PASS (9 tests)**.

- [ ] **Step 7: Commit** `feat: shared schemas for doc types, file validation and extraction`

### Task 4: Scaffold Next.js + dependencias

**Files:** Create `apps/web/**` (via create-next-app)

- [ ] **Step 1: Scaffold** (en la raíz):

```powershell
pnpm dlx create-next-app@15 apps/web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
```

- [ ] **Step 2: Dependencias** del workspace y de UI:

```powershell
pnpm --filter web add @documind/shared@workspace:*
pnpm --filter web add next-intl next-themes zustand react-dropzone
pnpm --filter web add pdfjs-dist@^4
pnpm --filter web add -D @playwright/test
```

- [ ] **Step 3: Verificar** — `pnpm --filter web dev` arranca en http://localhost:3000 (Ctrl+C para parar). En `apps/web/package.json` añadir scripts:

```json
"e2e": "playwright test",
"e2e:install": "playwright install chromium",
"typecheck": "tsc --noEmit"
existentes: "build", "dev", "lint", "start"
```

- [ ] **Step 4: Commit** `chore: scaffold next.js web app`

### Task 5: Tokens Aurora + fuentes + tema

**Files:** Modify `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`; Create `apps/web/src/components/theme-toggle.tsx`

- [ ] **Step 1:** reemplazar `apps/web/src/app/globals.css` con tokens (dark default, light derivado):

```css
@import "tailwindcss";

:root {
  --bg: #F7F4FB; --bg-2: #EFEAF6;
  --surface: #FFFFFF; --glass: rgba(255, 255, 255, 0.75);
  --border: #E7E2F0; --border-accent: #C855F5;
  --text: #241B30; --text-2: #6E6480; --text-3: #9C93AD;
  --accent: #7C5CFF; --accent-2: #C855F5;
  --accent-soft: rgba(124, 92, 255, 0.12);
  --success: #0E9F6E;
  --json-key: #7A5ACC; --json-string: #9A6B1F; --json-number: #0E7490; --json-punct: #9C93AD;
  --glow: 0 18px 80px rgba(200, 85, 245, 0.18);
}

.dark {
  --bg: #0C0813; --bg-2: #170E23;
  --surface: #130C1F; --glass: rgba(255, 255, 255, 0.05);
  --border: rgba(255, 255, 255, 0.08); --border-accent: rgba(200, 85, 245, 0.4);
  --text: #F5F2FA; --text-2: #B3A9C9; --text-3: #8D82A8;
  --accent: #7C5CFF; --accent-2: #C855F5;
  --accent-soft: rgba(200, 85, 245, 0.15);
  --success: #5FE0A8;
  --json-key: #C98BFF; --json-string: #5FE0A8; --json-number: #F0B86B; --json-punct: #6E6480;
  --glow: 0 18px 80px rgba(200, 85, 245, 0.18);
}

@theme inline {
  --color-bg: var(--bg); --color-bg-2: var(--bg-2);
  --color-surface: var(--surface); --color-glass: var(--glass);
  --color-border: var(--border); --color-border-accent: var(--border-accent);
  --color-text: var(--text); --color-text-2: var(--text-2); --color-text-3: var(--text-3);
  --color-accent: var(--accent); --color-accent-2: var(--accent-2);
  --color-accent-soft: var(--accent-soft); --color-success: var(--success);
  --font-display: var(--font-display); --font-body: var(--font-body); --font-mono: var(--font-mono);
}

body { background: var(--bg); color: var(--text); font-family: var(--font-body), system-ui, sans-serif; }
```

- [ ] **Step 2:** fuentes en `apps/web/src/app/layout.tsx` (por ahora el layout básico de Next) — imports:

```tsx
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
```
y en `<html className={\`${display.variable} ${body.variable} ${mono.variable}\`}>`.

- [ ] **Step 3:** `apps/web/src/components/theme-toggle.tsx`:

```tsx
"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("theme");
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" aria-hidden />;
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-label={t(dark ? "toLight" : "toDark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-2 transition hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
```

- [ ] **Step 4: Verificar** — el build compila: `pnpm --filter web build` → success (los tokens aún no se visualizan; se verán en los tasks 7–8).

- [ ] **Step 5: Commit** `feat: aurora design tokens, fonts and theme toggle`

### Task 6: i18n (next-intl · es/en)

**Files:** Create `apps/web/src/i18n/*`, `apps/web/src/messages/*`, `apps/web/src/middleware.ts`; Modify `apps/web/next.config.ts`, layout; Move `app/page.tsx` → `app/[locale]/page.tsx`

- [ ] **Step 1:** `apps/web/src/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";
export const routing = defineRouting({ locales: ["es", "en"], defaultLocale: "es" });
```

`apps/web/src/i18n/navigation.ts`:
```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

`apps/web/src/i18n/request.ts`:
```ts
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
```

`apps/web/src/middleware.ts`:
```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
export default createMiddleware(routing);
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
```

`apps/web/next.config.ts` — envolver con el plugin:
```ts
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin();
// export default withNextIntl(nextConfig) — conservar el objeto existente
```

- [ ] **Step 2:** mensajes completos.

`apps/web/src/messages/es.json`:
```json
{
  "theme": { "toLight": "Cambiar a tema claro", "toDark": "Cambiar a tema oscuro" },
  "nav": { "brand": "DocuMind", "settings": "Ajustes" },
  "upload": {
    "badge": "IA DE VISIÓN · TIER GRATIS",
    "title": "De documento a datos, en un solo gesto",
    "subtitle": "Sube una imagen o PDF. La IA de visión detectará el tipo de documento y devolverá sus datos en JSON, listos para usar.",
    "dropTitle": "Arrastra tu documento aquí",
    "browse": "o haz clic para explorar tus archivos",
    "caption": "Máx. {{maxMb}} MB por archivo · Procesamiento privado",
    "unsupported": "Formato no admitido. Usa JPG, PNG, WEBP o PDF.",
    "tooLarge": "El archivo supera {{maxMb}} MB."
  },
  "review": {
    "back": "Volver",
    "status": "Extracción lista",
    "panel": "EXTRACCIÓN",
    "copy": "Copiar JSON",
    "copied": "¡Copiado!",
    "download": "Descargar .json",
    "page": "Página {{page}} / {{total}}",
    "zoom": "100% · Ajustar",
    "empty": "No hay documento activo. Sube uno para comenzar."
  }
}
```

`apps/web/src/messages/en.json`: estructura idéntica con:
```json
{
  "theme": { "toLight": "Switch to light theme", "toDark": "Switch to dark theme" },
  "nav": { "brand": "DocuMind", "settings": "Settings" },
  "upload": {
    "badge": "VISION LLM · FREE TIER",
    "title": "From document to data, in a single gesture",
    "subtitle": "Upload an image or PDF. The vision LLM will detect the document type and return its data as ready-to-use JSON.",
    "dropTitle": "Drag your document here",
    "browse": "or click to browse your files",
    "unsupported": "Unsupported format. Use JPG, PNG, WEBP or PDF.",
    "tooLarge": "File exceeds {{maxMb}} MB."
  },
  "review": {
    "back": "Back", "status": "Extraction ready", "panel": "EXTRACTION",
    "copy": "Copy JSON", "copied": "Copied!", "download": "Download .json",
    "page": "Page {{page}} / {{total}}", "zoom": "100% · Fit",
    "empty": "No active document. Upload one to get started."
  }
}
```
(«review.caption» usa la misma frase que «upload.caption»).

- [ ] **Step 3:** reestructurar app: mover `apps/web/src/app/page.tsx` a `apps/web/src/app/[locale]/page.tsx` (se reescribe en Task 7) y crear `apps/web/src/app/[locale]/layout.tsx`:

```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../../globals.css";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh antialiased flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```
(borrar `apps/web/src/app/layout.tsx`, `app/page.tsx` y `app/favicon.ico` se conserva en `app/`).

- [ ] **Step 4: Verificar** — `pnpm --filter web build` → success; `http://localhost:3101/es` redirige desde `/` (middleware).

- [ ] **Step 5: Commit** `feat: next-intl es/en routing and messages`

### Task 7: Página «Subir» (dropzone clickeable + store)

**Files:** Create `apps/web/src/lib/store.ts`, `apps/web/src/components/navbar.tsx`, `apps/web/src/components/upload-dropzone.tsx`; Modify `apps/web/src/app/[locale]/page.tsx`

- [ ] **Step 1:** `apps/web/src/lib/store.ts`:

```ts
import { create } from "zustand";

export type ActiveDoc = {
  name: string; mime: string; size: number; objectUrl: string;
};

type ActiveDocState = {
  doc: ActiveDoc | null;
  set: (doc: ActiveDoc) => void;
  clear: () => void;
};

export const useActiveDoc = create<ActiveDocState>((set) => ({
  doc: null,
  set: (doc) => set({ doc }),
  clear: () => set({ doc: null }),
}));
```

- [ ] **Step 2:** `apps/web/src/components/navbar.tsx`:

```tsx
"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ThemeToggle } from "./theme-toggle";

export function Navbar({ left }: { left?: React.ReactNode }) {
  const t = useTranslations("nav");
  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-border px-7">
      <div className="flex items-center gap-3">
        {left}
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#E37BEA,#7C5CFF)]" />
        <span className="font-display text-[15px] font-semibold text-text">{t("brand")}</span>
        <span className="font-mono text-[10px] text-text-3">v0.1</span>
      </div>
      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <button
          type="button"
          aria-label={t("settings")}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-2"
        >
          ☰
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3:** `apps/web/src/components/upload-dropzone.tsx`:

```tsx
"use client";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, validateFile } from "@documind/shared";
import { useActiveDoc } from "@/lib/store";

const MAX_MB = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));

const ACCEPT = Object.fromEntries(ACCEPTED_MIME_TYPES.map((m) => [m, []]));

export function UploadDropzone() {
  const t = useTranslations("upload");
  const locale = useLocale();
  const router = useRouter();
  const set = useActiveDoc((s) => s.set);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (files: File[]) => {
      setError(null);
      const file = files[0];
      if (!file) return;
      const result = validateFile(file);
      if (!result.ok) {
        setError(result.error === "file-too-large" ? t("tooLarge", { maxMb: MAX_MB }) : t("unsupported"));
        return;
      }
      set({ name: file.name, mime: file.type, size: file.size, objectUrl: URL.createObjectURL(file) });
      router.push(`/${locale}/review`);
    },
    [set, router, locale, t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPT, multiple: false, noClick: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`w-full max-w-[660px] cursor-pointer rounded-[18px] border px-8 py-14 text-center transition ${
        isDragActive ? "border-border-accent bg-accent-soft" : "border-border bg-glass"
      }`}
      style={{ boxShadow: "var(--glow)" }}
    >
      <input {...getInputProps()} aria-label={t("browse")} />
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#E37BEA,#7C5CFF)] text-2xl">
        ⬆
      </div>
      <p className="text-[16px] font-medium text-text">{t("dropTitle")}</p>
      <p className="mt-1.5 text-[14px] text-text-2">{t("browse")}</p>
      <div className="mt-5 flex items-center justify-center gap-2">
        {["JPG", "PNG", "WEBP", "PDF"].map((f) => (
          <span key={f} className="rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-text-2">
            {f}
          </span>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-[13px] text-red-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4:** reescribir `apps/web/src/app/[locale]/page.tsx`:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Navbar } from "@/components/navbar";
import { UploadDropzone } from "@/components/upload-dropzone";

type Props = { params: Promise<{ locale: string }> };

export default async function UploadPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg">
      <Navbar />
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-16 text-center">
        <p className="rounded-full border border-border-accent bg-accent-soft px-3.5 py-1.5 font-mono text-[11px] font-medium tracking-[1.4px] text-text-2">
          {t("upload.badge")}
        </p>
        <h1 className="max-w-[720px] font-display text-4xl font-bold leading-[1.12] tracking-tight text-text md:text-[44px]">
          {t("upload.title")}
        </h1>
        <p className="max-w-[620px] text-[16px] leading-relaxed text-text-2">{t("upload.subtitle")}</p>
        <UploadDropzone />
        <p className="text-[12.5px] text-text-3">
          {t("upload.caption", { maxMb: Math.round(20) })}
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Verificar** — `pnpm --filter web dev`; probar en `/es`: arrastrar un PNG → navega a `/es/review` (aún 404 hasta Task 8); soltar un ZIP → mensaje de error. Lint/typecheck: `pnpm --filter web typecheck && pnpm --filter web lint`.

- [ ] **Step 6: Commit** `feat: upload page with clickable drag&drop (aurora)`

### Task 8: Página «Revisión» (preview + JSON)

**Files:** Create `apps/web/src/app/[locale]/review/page.tsx`, `apps/web/src/components/document-preview.tsx`, `apps/web/src/components/json-panel.tsx`

- [ ] **Step 1:** `apps/web/src/components/document-preview.tsx` (con render PDF pdf.js):

```tsx
"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { ActiveDoc } from "@/lib/store";

function PdfPreview({ url, page }: { url: string; page: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      try {
        const doc = await pdfjs.getDocument(url).promise;
        const pageDoc = await doc.getPage(page);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const viewport = pageDoc.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await pageDoc.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url, page]);
  if (error) return <div className="text-text-3">PDF no renderizable</div>;
  return <canvas ref={canvasRef} className="max-h-full max-w-full rounded-lg bg-white" />;
}

export function DocumentPreview({ doc }: { doc: ActiveDoc }) {
  return (
    <section className="flex h-full min-w-0 flex-1 items-center justify-center bg-[#0F0A18] p-6">
      {doc.mime === "application/pdf"
        ? <PdfPreview url={doc.objectUrl} page={1} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={doc.objectUrl} alt={doc.name} className="max-h-full max-w-full rounded-lg" />}
    </section>
  );
}
```
(El paginador «Página 1/N» completo llega con estados; se muestra también el pill con `useTranslations("review.page")` cuando se conocen las páginas.)

- [ ] **Step 2:** `apps/web/src/components/json-panel.tsx` (resaltado de sintaxis + copiar + descargar):

```tsx
"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ExtractionResult } from "@documind/shared";

/* Tokeniza cada línea JSON para colorearla. */
function renderLine(line: string, ix: number) {
  const re = /"(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|./g;
  const out: JSX.Element[] = [];
  let m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(line))) {
    const [tok0, colon] = m;
    const cls = tok0.startsWith('"') ? (colon ? "text-[color:var(--json-key)]" : "text-[color:var(--json-string)]")
      : /^(true|false|null)$/.test(tok0) ? "text-[color:var(--json-number)]"
      : /^-?\d/.test(tok0) ? "text-[color:var(--json-number)]"
      : "text-[color:var(--json-punct)]";
    out.push(<span key={`${ix}-${k++}`} className={cls}>{tok0}</span>);
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

export function JsonPanel({ value }: { value: ExtractionResult }) {
  const t = useTranslations("review");
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);

  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const onDownload = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = "extraccion.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col border-l border-border bg-surface">
      <header className="flex h-[52px] items-center gap-2.5 px-5">
        <span className="font-mono text-[11px] font-medium tracking-[1.4px] text-text-3">{t("panel")}</span>
        <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.8px] text-[color:var(--json-key)]">
          {value.tipo_documento.toUpperCase()}
        </span>
        <div className="flex-1" />
        <button type="button" onClick={onCopy} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] text-text-2 hover:text-text">
          {copied ? t("copied") : t("copy")}
        </button>
        <button type="button" onClick={onDownload} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] text-text-2 hover:text-text">
          {t("download")}
        </button>
      </header>
      <div className="flex-1 overflow-auto p-5">
        <pre className="font-mono text-[13px] leading-[1.65]">{text.split("\n").map((l, ix) => (<div key={ix}>{renderLine(l, ix)}</div>))}</pre>
      </div>
      <footer className="flex h-10 items-center justify-between border-t border-border px-5 font-mono text-[11px] text-text-3">
        <span>qwen/qwen3.8-27b:free</span>
        <span>datos de muestra · M0</span>
      </footer>
    </section>
  );
}
```

- [ ] **Step 3:** `apps/web/src/app/[locale]/review/page.tsx`:

```tsx
"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SAMPLE_EXTRACTION } from "@documind/shared";
import { DocumentPreview } from "@/components/document-preview";
import { JsonPanel } from "@/components/json-panel";
import { Navbar } from "@/components/navbar";
import { useActiveDoc } from "@/lib/store";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ReviewPage() {
  const doc = useActiveDoc((s) => s.doc);
  const clear = useActiveDoc((s) => s.clear);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("review");

  useEffect(() => {
    if (!doc) router.replace(`/${locale}`);
  }, [doc, router, locale]);

  if (!doc) return null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-bg">
      <Navbar left={
        <>
          <button
            type="button"
            aria-label={t("back")}
            onClick={() => { clear(); router.push(`/${locale}`); }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-2"
          >
            ←
          </button>
          <span className="text-[14px] font-medium text-text">{doc.name}</span>
          <span className="flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-[12px] text-[color:var(--success)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />
            {t("status")}
          </span>
        </>
      } />
      <div className="flex h-[calc(100dvh-64px)] flex-col md:flex-row">
        <div className="h-full flex-1"><DocumentPreview doc={doc} /></div>
        <div className="h-full flex-1"><JsonPanel value={SAMPLE_EXTRACTION} /></div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verificar** — subir una imagen en `/es` → `/es/review` muestra preview a la izquierda y JSON coloreado a la derecha; «Copiar» escribe JSON válido. `pnpm --filter web typecheck && pnpm --filter web lint`.

- [ ] **Step 5: Commit** `feat: review page with document preview and json panel`

### Task 9: E2E smoke (Playwright)

**Files:** Create `apps/web/playwright.config.ts`, `apps/web/e2e/upload.spec.ts`, `apps/web/e2e/fixtures/sample.png`

- [ ] **Step 1:** fixture (PNG 1×1 válido):

```powershell
New-Item -ItemType Directory -Force apps/web/e2e/fixtures | Out-Null
node -e "require('fs').writeFileSync('apps/web/e2e/fixtures/sample.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'))"
```

- [ ] **Step 2:** `apps/web/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3101", locale: "es" },
  webServer: {
    command: "pnpm dev -- --port 3101",
    url: "http://localhost:3101",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

- [ ] **Step 3:** `apps/web/e2e/upload.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("1×1 PNG → /es/review muestra el JSON de muestra", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("e2e/fixtures/sample.png");
  await expect(page).toHaveURL(/\/es\/review$/);
  await expect(page.getByText('"tipo_documento"')).toBeVisible();
  const copyBtn = page.getByRole("button", { name: "Copiar JSON" });
  await copyBtn.click();
  await expect(page.getByRole("button", { name: "¡Copiado!" } )).toBeVisible();
});

test("rechaza un tipo no admitido", async ({ page }) => {
  await page.goto("/es");
  await page.locator('input[type="file"]').setInputFiles({
    name: "doc.zip", mimeType: "application/zip", buffer: Buffer.from("PK"),
  });
  await expect(page.getByText("Formato no admitido")).toBeVisible();
  await expect(page).toHaveURL(/\/es$/);
});
```

- [ ] **Step 4: Verificar** — `pnpm --filter web e2e:install` (una vez) y `pnpm --filter web e2e` → **2 passed**.

- [ ] **Step 5: Commit** `test: e2e smoke for upload and review flow`

### Task 10: Gates finales

- [ ] **Step 1:** `pnpm lint && pnpm typecheck && pnpm build` a nivel raíz (Turbo ejecuta todo el workspace) → todos PASS.
- [ ] **Step 2:** comprobar `docker compose ps` → `documind-db` healthy.
- [ ] **Step 3:** recorrer la app a mano: `/es` (drag & drop + clic + error de tipo), `/en` ídem, toggle de tema, «Copiar»/«Descargar».
- [ ] **Step 4: Commit** (si quedan alarmas) `chore: m0 final pass` — **y aquí termina M0**.

---

## Siguientes hitos (fuera de este plan)

- **M1** `apps/api` NestJS: migraciones Drizzle (schema de `docs/ARCHITECTURE.md` §4), `POST /documents`, adapter `OpenRouterProvider` (Qwen3.8 27B `:free` por defecto), endpoint `/extract`.
- **M2** Pantalla `/settings` (se diseñará en OpenPencil estilo Aurora), cifrado AES-256-GCM de la API key, catálogo free, embeddings Nemotron 3 Embed 1B y `/search`.
