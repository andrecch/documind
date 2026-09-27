# Rediseño — Mundo «Talonario» — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: usar la skill local `executing-plans`. Steps con checkbox (`- [ ]`).
> **Skill rectora:** `impeccable` (new-work, comp-led). Seed `eeb832d8` · modo Operate · mundo elegido: **Talonario de facturas** (IMPECCABLE'S PICK, confirmado por el usuario).

## Contrato de dirección (THESIS/OWN-WORLD/STORY/FIRST VIEWPORT/FORM)

- **THESIS:** la pantalla entera es una hoja preimpresa del talonario que la IA de visión rellena sola; el JSON extraído es su copia carbón. Rechaza el look "AI nocturno con glow" (mundo anterior) y el SaaS genérico.
- **OWN-WORLD:** papel `#FDFCF8` sobre mesa `#F7F4EA`; retícula y campos reglados en azul de tinta `#2E4E9E`; bandas de encabezado `#EEF1F8`; tinta carbón `#26231E`; serial y estados sellados en rojo `#C03A2B`; verde verificación `#3D7A4E`. Carbón: `#26231E` con JSON en `#D8D2C6`/`#8FB8A6`/`#9AE3C8`/`#F0B86B`.
- **STORY:** el usuario entiende que su documento entra como original (verificable, nunca recortado), la IA rellena los campos numerados y la copia carbón (JSON) queda disponible para copiar/descargar; máquina y confianza siempre visibles.
- **FIRST VIEWPORT (Subir):** la hoja con campo 1 «ADJUNTE DOCUMENTO» grande y reglado (dropzone), campos 2-6 en blanco visible, serial rojo «SERIE A · Nº 000123», copia carbón al pie.
- **FORM:** candidato pick de la mano grounded (seed eeb832d8), comp aprobada: artboard E (Subir) y V2 · Partida (Revisión) en OpenPencil.
- **FINISH:** "unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance".

## Decisiones de sistema

1. **Tipografía** (razón de sujeto, no default de entrenamiento): `Archivo Narrow` (rótulos/caps preimpresos, 600-800) + `Courier Prime` (datos, serial, JSON, máquina de escribir). Fuera: Space Grotesk, Inter, JetBrains Mono.
2. **Iconos**: `lucide-react` (Upload, Settings, Copy, Download, ArrowLeft, ChevronLeft/Right, Sun/Moon) — prohibidos los glifos de texto `⬆ ☰ ←`.
3. **Temas**: claro por defecto (escena oficina de día); `.dark` derivado «taller de carbón nocturno» (hoja `#26231E`, tinta `#F5EFE2`, azul regla `#7A93C9`); toggle dark/light se conserva.
4. **Comps aprobadas (ley)**: `openpencil` — página «DocuMind · Rediseño · Direcciones» board E; página «DocuMind · Revisión · Talonario» V2. Fases de build: reproducir comps a 1440×900 casi píxel-perfecto → responsive móvil → verificación batched.

## Tasks

### Task 1 — Tokens y tipografía

- [ ] `globals.css`: reemplazar tokens Aurora por Talonario (claro default + `.dark` derivado); mantener el patrón `@theme inline`.
- [ ] `apps/web/src/app/[locale]/layout.tsx`: fuentes → `Archivo_Narrow` (600/700/800 → `--font-display`) y `Courier_Prime` (400/700 → `--font-mono`); quitar Space Grotesk/Inter/JetBrains Mono.
- [ ] `pnpm --filter web add lucide-react`.
- [ ] Build + commit `feat: talonario design tokens and fonts`.

### Task 2 — Página Subir (comp E)

- [ ] `upload-dropzone.tsx`: campo 1 reglado (blanco, banda `EEF1F8`, interior con dropzone interior azul punteada), chips JPG/PNG/WEBP/PDF mono azul, icono lucide `Upload`; mensajes i18n del talonario; manejo de rejections actual.
- [ ] `[locale]/page.tsx`: hoja con serial rojo «SERIE A · Nº 000123» (contador de sesión mock), campos 2-6 en blanco (TIPO con chips de los 5 tipos en gris, FECHA/TOTAL/CONFIANZA en ruleta punteada), fila de copia carbón al pie (dark, JSON de muestra) con «VER COPIA COMPLETA →» deshabilitado.
- [ ] `navbar.tsx`: logo cuadrado rojo DM, nombre, serial; derecha: ES/EN (i18n), toggle (lucide Sun/Moon), ajustes (lucide Settings).
- [ ] Verificación playwright-cli: capturas `/es` desktop+mobile → commit `feat: upload page in talonario world`.

### Task 3 — Página Revisión (comp V2 · Partida)

- [ ] Split 50/50: izquierda «EL ORIGINAL» (imagen inline o PDF pdf.js con sello «LEÍDO» overlay + paginador mono), derecha «LA HOJA RELLENADA» (campos numerados con datos de SAMPLE_EXTRACTION) + «LA COPIA CARBÓN» (strip dark con JSON) + toggle «VER COPIA COMPLETA» que muestra el JSON completo (tokenizado) en el strip expandido.
- [ ] `json-panel.tsx` → renombrar a `extraction-sheet.tsx` (vista hoja + carbón con resaltado); estados vacío/error con i18n.
- [ ] Verificación playwright-cli → commit `feat: review page as filled sheet with carbon copy`.

### Task 4 — i18n y estados

- [ ] `messages/es.json` / `en.json`: copy del talonario (hoja, campos, sellos, carbón); claves theme.* revisadas.
- [ ] Commit `feat: talonario copy in es/en`.

### Task 5 — E2E y gates

- [ ] Actualizar `e2e/upload.spec.ts` (selectores por rol/label i18n nuevos).
- [ ] `pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm e2e` → todo verde.
- [ ] Commit `test: e2e for talonario ui`.

### Task 6 — Inspección y cierre (impeccable)

- [ ] Capturas batched (desktop 1440 + mobile 390, ambas páginas, `es`) a `.impeccable/review/`.
- [ ] `node .agents/skills/impeccable/scripts/detect.mjs --json` sobre los targets cambiados; fixes mecánicos.
- [ ] Spawn `impeccable-finish-reviewer` (input packet completo, sin historial heredado) → actuar por disposition (fix/rebuild/ship).
- [ ] Documenter → **`DESIGN.md`** desde el mundo construido + sidecar (continuidad para Settings/Historial). Commit `docs: design.md for the talonario world`.
