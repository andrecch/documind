# DocuMind — Sistema de diseño «Dark Aurora»

> Dirección elegida: **Opción C · Dark Aurora** (ver artboards `C1 · Upload — Dark aurora` y `C2 · Revisión — Dark aurora` en la página «DocuMind · Propuestas UI» de OpenPencil).

## 1. Concepto

Producto de IA con fondo oscuro profundo, acento con degradado fucsia→violeta, superficies *glass* (blanco translúcido) y glows radiales como firma visual. El look «datos» (JSON) usa tipografía monoespaciada con resaltado violeta/verde/ámbar.

## 2. Tokens

### Colores — Dark (por defecto)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0C0813` | Fondo de página (degradado 180° → `#170E23` al pie) |
| `--surface` | `#130C1F` | Paneles (preview, JSON) |
| `--glass` | `rgba(255,255,255,0.05)` | Dropzone, tarjetas glass |
| `--border` | `rgba(255,255,255,0.08)` | Bordes de tarjetas/divider |
| `--border-accent` | `rgba(200,85,245,0.40)` | Borde activo del dropzone |
| `--text` | `#F5F2FA` | Títulos y textos primarios |
| `--text-2` | `#B3A9C9` | Texto secundario |
| `--text-3` | `#8D82A8` | Texto terciario/metadata |
| `--accent` | `#7C5CFF` | Acción primaria |
| `--accent-2` | `#C855F5` | Extremo del degradado |
| `--accent-soft` | `rgba(200,85,245,0.15)` | Fondos de badge/pill |
| `--success` | `#5FE0A8` | Estado «listo», strings del JSON |
| `--json-key` | `#C98BFF` | Claves JSON |
| `--json-string` | `#5FE0A8` | Valores string |
| `--json-number` | `#F0B86B` | Valores numéricos |
| `--json-punct` | `#6E6480` | Llaves/comas/indentación |

### Colores — Light (derivado, para el toggle)

| Token | Valor |
|---|---|
| `--bg` | `#F7F4FB` · degradado → `#EFEAF6` |
| `--surface` | `#FFFFFF` |
| `--glass` | `rgba(255,255,255,0.75)` |
| `--border` | `#E7E2F0` · `--border-accent: #C855F5` |
| `--text` | `#241B30` · `--text-2: #6E6480` · `--text-3: #9C93AD` |
| `--accent` | `#7C5CFF` · `--accent-soft: rgba(124,92,255,0.12)` |
| `--success` | `#0E9F6E` · JSON: key `#7A5ACC`, string `#9A6B1F`, number `#0E7490`, punct `#9C93AD` |

Gradient primario (logo, iconos, toggle activo): `135° #E37BEA → #7C5CFF`.

### Tipografía

| Cargo | Fuente | Peso | Tamaño |
|---|---|---|---|
| Display/H1 | Space Grotesk | 700 | 40–44 px, lh 1.12, ls −0.8 |
| Subtítulos | Inter | 400/500 | 14–16 px, lh 1.5 |
| UI/body | Inter | 400–600 | 13–15 px |
| Código/JSON/labels | JetBrains Mono | 400–600 | 11–13 px |
| Eyebrows (uppercase) | JetBrains Mono | 500–600 | 11 px, ls +1.4 |

### Forma, sombra y glow

- Radios: botones/chips `8–999`, tarjetas `12–18`, tiles icono `14–16`.
- Glass: `fill --glass` + `border --border` + radius 14–18.
- Glow firma: `shadow 0 18px 80px rgba(200,85,245,0.18)` en dropzone; halo `0 0 40px rgba(200,85,245,0.25)` en el documento de preview.
- Glows ambientales: elipses radiales (fucsia `#C855F538` → transparente) en esquinas del hero.

## 3. Componentes

1. **Navbar** (64 px, padding 28): logo tile 28 r8 con gradiente + glifo escaneo; acciones derecha: select idioma (ES/EN), switch de tema, icon-button ajustes.
2. **Dropzone**: glass 660×300 r18, borde `--border-accent` al arrastrar; tile 58 con gradiente + flecha de subida; textos «Arrastra…» / «o haz clic para explorar»; chips de formatos JPG·PNG·WEBP·PDF (mono 11); caption límite 20 MB.
3. **Review split**: 50/50 con divider 1px `--border`. Izquierda: lienzo `#0F0A18`, documento blanco 4:5.5 r10 con doble sombra (negra + halo fucsia), paginador pill «Página 1 / N» con chevrons y zoom. Derecha: header «EXTRACCIÓN» + badge tipo doc + copy/download; cuerpo JSON en tarjeta glass r14; footer modelo/tokens/confianza (mono 11).
4. **Badge de tipo de documento**: pill bg `--accent-soft`, texto mono 600 `#E5A8FF` (dark) / `#7A5ACC` (light), ls +0.8.
5. **Estados**: dot 6px `--success` «Extracción lista»; pendiente = dot ámbar; error = destructive `#F87171`.

## 4. Pantallas

| Ruta (`/es`,`/en`) | Contenido | Estado |
|---|---|---|
| `/` | Navbar + hero (badge eyebrow, H1, subtítulo) + Dropzone + caption | ✅ artboard C1 |
| `/review` | Navbar con back + filename + estado; split preview/JSON | ✅ artboard C2 |
| `/settings` | (M2) API key + modelos vision/embedding + catálogo free | ⏳ por diseñar en Aurora |

## 5. Accesibilidad

- Contraste: `--text-2` sobre `--bg` ≥ 7:1; `--text-3` solo para metadata ≥ 4.5:1; estados nunca solo por color (dot + texto).
- `:focus-visible` ring 2px `--accent` en dropzone/botones; dropzone accesible por teclado (Enter/Espacio abre el explorador vía input file).
- El toggle de tema usa `next-themes` (evita FOUC con `suppressHydrationWarning`).

## 6. i18n y contenido

- Los copy exactos por pantalla viven en `apps/web/src/messages/es.json` / `en.json`.
- Español: «De documento a datos, en un solo gesto» — Inglés: «From document to data, in a single gesture».
