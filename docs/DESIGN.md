# DocuMind — Sistema de diseño «Talonario de facturas»

> Mundo elegido en la ronda de direcciones (seed `eeb832d8`, modo Operate) y construido en la rama `feat/redesign-world`. Reemplaza a «Dark Aurora». Registra el sistema **desde el código construido**, no una intención.
> Comps aprobados (ley): board E «Talonario» (Subir) y «V2 · Partida» (Revisión) en OpenPencil — páginas «DocuMind · Rediseño · Direcciones» y «DocuMind · Revisión · Talonario».

## 1. Tesis

La pantalla es una **hoja preimpresa del talonario** que la IA de visión rellena sola; el JSON extraído es su **copia carbón**. El usuario reconoce el formulario administrativo que ya sabe leer: campos numerados con banda de encabezado, serial rojo sellado y una copia carbón siempre visible al pie. Se rechaza el look genérico "AI nocturno" (mundo anterior, Dark Aurora) y el SaaS corporativo neutro.

## 2. Modo y escena

- **Modo: Operate** — el visitante completa una tarea (subir un documento, revisar sus datos). Escaneabilidad, affordances familiares y la tarea por encima de la expresión.
- **Escena física:** escritorio de oficina de día → tema **claro por defecto**; `.dark` derivado como «taller de carbón nocturno» con toggle.

## 3. Tokens (ground truth: `apps/web/src/app/globals.css`)

### Claro (por defecto)

| Token                              | Valor                                         | Uso                                                          |
| ---------------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| `--bg`                             | `#F7F4EA`                                     | Mesa/ground de la app                                        |
| `--sheet`                          | `#FDFCF8`                                     | Hoja: tarjetas, campos, nav                                  |
| `--band`                           | `#EEF1F8`                                     | Bandas de encabezado de campo                                |
| `--rule`                           | `#2E4E9E`                                     | Retícula azul: bordes de campo, dropzone, acento estructural |
| `--rule-soft`                      | `#C9D2E8`                                     | Líneas placeholders, seriales decorativos, divisores         |
| `--border`                         | `#E2DFD2`                                     | Bordes neutros (nav)                                         |
| `--text`                           | `#26231E`                                     | Tinta carbón: títulos, datos                                 |
| `--text-2`                         | `#55503F`                                     | Texto secundario (≥ 7:1 sobre hoja)                          |
| `--text-3`                         | `#5A6584`                                     | Etiquetas de campo (AA sobre hoja)                           |
| `--accent`                         | `#C03A2B`                                     | Serial, sellos de estado, acciones de énfasis                |
| `--accent-soft`                    | `#F7E4E1`                                     | Fondo suave del acento                                       |
| `--success`                        | `#3D7A4E`                                     | Verificación (confianza, LISTA)                              |
| `--carbon`                         | `#26231E`                                     | La copia carbón (JSON)                                       |
| `--carbon-text/-soft/-key/-number` | `#D8D2C6` / `#8FB8A6` / `#9AE3C8` / `#F0B86B` | Strings / metadata / claves / números dentro del carbón      |

### Oscuro (derivado «taller de carbón nocturno»)

`--bg #14110C` · `--sheet #26231E` · `--band #33302A` · `--rule #8AA0D4` · `--text #F5EFE2` · `--text-2 #C0B8A4` · `--text-3 #A8A091` · `--accent #D95A4A` · `--success #7BC98F` · `--carbon #0E0D0B` (carbón más profundo que la hoja).

## 4. Tipografía (razón de sujeto, no defaults de entrenamiento)

| Cargo                                     | Fuente                                            | Uso                                |
| ----------------------------------------- | ------------------------------------------------- | ---------------------------------- |
| Rótulos preimpresos, headers de campo, H1 | **Archivo Narrow** 600–800, caps, tracking +1–1.6 | Toda etiqueta uppercase de la hoja |
| Datos, serial, JSON, placeholders         | **Courier Prime** 400–700                         | Todo lo que "se escribe a máquina" |
| Prosa breve (subtítulos, captions)        | Archivo Narrow 400                                | Texto corrido corto                |

Prohibido volver a Inter/Space Grotesk/IBM Plex sin razón nueva de sujeto.

## 5. Componentes (`apps/web/src/components`)

- **Navbar** (`navbar.tsx`): cuadrado rojo 24px (logo) + `DOCUMIND` (Archivo Narrow 700, 22px); derecha: `ThemeToggle` (lucide Sun/Moon) + ajustes (lucide Settings). En Revisión el slot `left` recibe el botón volver (lucide ArrowLeft). Sin serial decorativo (dato falso — eliminado por decisión del usuario).
- **SheetIllustration** (`sheet-illustration.tsx`): SVG inline de cabecera en vocabulario talonario — hoja reglada con sello de verificación → flecha → tarjeta de datos (carbón). Toma los tokens del tema (`stroke-rule`, `fill-carbon`, etc.); visible ≥ `md`.
- **UploadDropzone** (`upload-dropzone.tsx`): caja blanca con banda `EEF1F8` («ADJUNTE SU DOCUMENTO» — sin numeración) y zona interior azul punteada (`m-[10px]`, 300px de alto); activa = borde `--accent` + `bg-accent-soft`; error con `role="alert"` en Courier Prime rojo; chips JPG/PNG/WEBP/PDF mono azul; icono lucide `Upload`. Es el único módulo de la página Subir.
- **DocumentPreview** (`document-preview.tsx`): «EL ORIGINAL» sobre `bg-band/60` — **visor real: la imagen/PDF SIEMPRE llena el panel**, zoom 50–400% en pasos de 25% (lucide ZoomIn/ZoomOut + «AJUSTAR» reset), pan con scroll al ampliar; paginador real (numPages + chevrons lucide); estado de carga «PREPARANDO ORIGINAL…»; **sello «LEÍDO» en la cabecera del panel** (nunca sobre el documento).
- **ExtractionSheet** (`extraction-sheet.tsx`): «LA HOJA RELLENADA POR LA IA DE VISIÓN» — filas numeradas (1 Documento · 2 Tipo [badge rojo doble borde] · 3 Fecha · 4 Total · 5 Emisor/Receptor · 6 Confianza) + ÍTEMS con subtotal/IVA/total; barra de estado como píldora hoja (dot + texto verde); «Copiar» escribe JSON al portapapeles; «Descargar .json»; bloque **«DATOS EXTRAÍDOS · JSON»** al pie: banda oscura con perforaciones, JSON de 1 línea o expandido (tokenizado) con toggle «VER JSON COMPLETO →» / «← VER FORMULARIO».
- **ThemeToggle** (`theme-toggle.tsx`): next-themes `attribute="class"`, `defaultTheme="light"`.

## 6. Pantallas

| Ruta                  | Mundo                                                                                                                                                                                                                                                                                         | Comp                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `/es` · `/en` (Subir) | Acción única: header (h1 + tagline del producto + **SheetIllustration**) + Campo «ADJUNTE SU DOCUMENTO» como único protagonista — sin serial decorativo, campos vacíos ni franja de carbón                                                                                                    | board E simplificado (decisión del usuario) |
| `/review`             | **Ficha editable (M1)**: V2 · Partida — EL ORIGINAL (visor con zoom/pan, izq.) + formulario editable con inputs talonario e **ItemsGrid** (tabla editable, columnas por tipo de documento, der.); bloque «DATOS EXTRAÍDOS · JSON» como referencia; botón «CONFIRMAR Y ARCHIVAR» sella en rojo | V2 evolucionado (PRD v2)                    |
| `/settings` (M2)      | Hoja de configuración del mismo talonario (API key cifrada, modelos)                                                                                                                                                                                                                          | por diseñar — hereda este sistema           |

## 7. i18n y contenido

- Copy por pantalla en `src/messages/{es,en.json}`; todo texto visible pasa por `next-intl` (es default).
- Registro: la UI habla en primera persona del formulario («Suelte aquí su documento», «La hoja se llena sola»). Los datos de muestra viven en `@documind/shared` (`SAMPLE_EXTRACTION`), no en los mensajes — y **nunca se muestran datos falsos ni placeholders de valores**: la Subir solo promete con su copy, no con tarjetas vacías.

## 8. Accesibilidad (verificada en el finish review)

- Contraste AA: etiquetas `--text-3 #5A6584` (≥ 4.5:1 sobre hoja); estados nunca solo por color (dot + texto); contenido deshabilitado marcado con `disabled` + opacidad.
- Foco visible (`outline-accent`) en dropzone y botones; dropzone accesible por teclado.
- Iconos exclusivamente lucide-react — sin glifos tipográficos en controles.

## 9. Reglas de continuidad (para páginas nuevas)

1. Toda pantalla nueva es una hoja del mismo talonario: banda de encabezado, caja blanca, retícula azul, serial rojo para estados/identificadores.
2. JSON y datos SIEMPRE en Courier Prime dentro del bloque oscuro «DATOS EXTRAÍDOS» (`bg-carbon`), con la paleta de 4 colores de datos (`--carbon-key/-text/-soft/-number`). Ese bloque oscuro solo aparece donde hay datos reales.
3. Nada de glows, glass, gradientes ni fondos oscuros en claro; el bloque «DATOS EXTRAÍDOS» es el único oscuro permitido.
4. Iconos: lucide, `strokeWidth 1.8`.
5. Estados: sello rojo (completado/aprobado), rule-soft (pendiente), rojo Courier bold (error).
6. **No se muestran campos ni valores vacíos como si existieran**: una pantalla muestra solo lo que tiene datos reales; lo pendiente se comunica con copy, no con tarjetas placeholder.
