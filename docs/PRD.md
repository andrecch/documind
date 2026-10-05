# DocuMind — Documento de Requisitos de Producto (PRD)

> Estado: **v2.1** · 2026-10-03 · M1 cerrado: los criterios de aceptación llevan el estado real tras la verificación end-to-end con OpenRouter (v2.0 · 2026-09-26 · sesión de alineación grill-me: el producto es un **RAG de documentos validado por humano**). M2 construido el 2026-10-04 (US4–US6 implementados; ver estados marcados con ✅).

## 1. Visión

DocuMind es una web app **estable, rápida y eficiente, que sirve a modo de RAG**: el usuario sube una imagen o PDF, se procesa con **reconocimiento OCR mediante un LLM de visión**, los datos reconocidos se muestran como un **formulario editable** (labels + inputs), el usuario **confirma** el resultado y, solo entonces, se envía al **modelo de embeddings** y se guarda en la base de datos (PostgreSQL + pgvector). Sobre esa base archivada el usuario puede **buscar semánticamente** y **conversar con sus documentos** (chat con citas).

La validación humana es parte del producto: el dato que entra al RAG es el dato confirmado por el usuario.

## 2. Problema

Los documentos administrativos (facturas, contratos, recibos, documentación, propuestas) llegan en formatos no estructurados. Extraer sus datos manualmente es lento y propenso a errores; los servicios enterprise de pago son caros; y los RAG genéricos ingieren datos sin validar (basura entra, basura sale). DocuMind resuelve los tres: OCR gratuito con LLM de visión, corrección humana en un formulario familiar, y una base vectorial personal consultable por búsqueda y chat.

## 3. Objetivos

- **O1** — Subir documentos con drag & drop o clic, con vista previa.
- **O2** — Reconocer los datos del documento con OCR vía LLM de visión (Qwen3.8 27B `:free`).
- **O3** — Presentar los datos como formulario editable con labels e inputs según lo reconocido.
- **O4** — Confirmar el documento: gate explícito que envía los datos al modelo de embeddings y los archiva en la BD.
- **O5** — Auditar cada campo: valor reconocido por el LLM vs valor confirmado por el humano.
- **O6** — Búsqueda semántica sobre lo archivado (pgvector, Nemotron 3 Embed 1B).
- **O7** — Chat grounded: responde solo con contexto recuperado de los documentos del usuario, con citas clicables.
- **O8** — Gestionar proveedor, API key (cifrada) y modelos desde la propia UI.

## 4. Alcance por fases

| Fase                     | Contenido                                                                                                                                                   | Estado                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **UI inicial (M0)**      | Monorepo + Docker (Postgres/pgvector) + mundo visual «Talonario» con Subir y Revisión (visor)                                                               | ✅ hecho              |
| **M1 — Loop de ingesta** | Backend NestJS, upload real, OCR con LLM de visión, **formulario editable** (talonario), gate de confirmación, embeddings padre/hijo, persistencia completa | ✅ hecho (2026-10-03) |
| **M2 — Recuperación**    | `/search` semántica, **chat con citas**, pantalla de Configuración (API key cifrada, catálogo de modelos free)                                              | ✅ hecho (2026-10-04) |
| **M3 — Archivo**         | Historial con filtros por tipo, **re-edición de archivados en la web** (la API ya la soporta desde M1), export, afinado                                     | pendiente             |

**Fuera de alcance:** OCR local, autenticación multiusuario, facturación, apps móviles nativas, S3 (disco local vía volumen Docker en el MVP).

## 5. Usuarios

Profesional independiente hispanohablante que digitaliza sus propios documentos de forma esporádica, desde un escritorio de oficina de día. Su objetivo: convertirlos en una **base de conocimiento personal consultable** (búsqueda + chat) sin pagar herramientas enterprise y sin perder privacidad.

## 6. User Stories y criterios de aceptación

### US1 · Subir documento

> Como usuario, quiero arrastrar una imagen o PDF — o hacer clic para explorar — para procesar un documento.

- **AC1.1** ✅ Acepta `JPG`, `PNG`, `WEBP`, `PDF` ≤ **20 MB**; el dropzone es clickeable además de receptivo.
- **AC1.2** ✅ Tipos no admitidos o exceso de tamaño muestran error claro en el idioma activo.
- **AC1.3** ✅ PDFs multi-página se tratan como **un solo documento** (campos agregados de las N páginas; máx 8 páginas por extracción); el preview paginado queda disponible.

### US2 · Formulario editable (corazón del producto)

> Como usuario, quiero ver los datos que la IA reconoció como formulario con labels e inputs editables — corregirlos si se equivocó — y confirmar el documento para archivarlo en mi base.

- **AC2.1** ✅ Split 50/50: original (imagen/PDF paginado) a la izquierda; formulario a la derecha con los campos reconocidos como **inputs editables** (texto, fecha, moneda, números), no como ficha de solo lectura.
- **AC2.2** ✅ Todo editable: valores de campos, **ítems como grid de tabla editable** (columnas definidas por tipo de documento; documentos densos como una declaración DIAN de ~15 columnas × N filas son el caso real), añadir/eliminar filas, y el **tipo de documento** corregible si la IA clasificó mal (el grid se re-renderiza con el schema del tipo elegido).
- **AC2.3** ✅ Edición con autoguardado (debounce 800 ms) y validación con el esquema compartido (Zod) en el servidor; la discrepancia de totales se marca con alerta ámbar sin bloquear.
- **AC2.4** ✅ El botón **«CONFIRMAR Y ARCHIVAR»** confirma con los datos editados (primero vuelca el autoguardado pendiente); al confirmar pasa el estado a `confirmed`.
- **AC2.5** ✅ **Auditoría por campo**: el servidor recalcula `field_audit` (valor LLM vs humano, paths planos tipo `items.0.valor_total`) en cada edición; historial `extraction_revisions` por acción.
- **AC2.6** ✅ Al confirmar: se genera el texto natural del documento + chunks hijos por ítem → embedding (2048 dims) → inserción en pgvector → estado `ARCHIVADO` (sello visible; verificado con embeddings reales de Nemotron).

### US3 · Re-editar un documento archivado

> Como usuario, quiero reabrir un documento archivado, corregir algo y guardar, sabiendo que sus vectores se actualizan.

- **AC3.1** ✅ (API; UI de re-edición en M3) Editable + **re-embed** en cada guardado vía `PATCH /extraction/confirmed` (los chunks antiguos se reemplazan transaccionalmente); la BD siempre refleja la verdad actual. La web muestra el archivado en solo lectura hasta M3.
- **AC3.2** ✅ Cada edición guarda nueva auditoría (`field_audit` recalculado + revisión `post_confirm_edit` en el historial).

### US4 · Búsqueda semántica (M2 — ✅ hecho 2026-10-04)

> Como usuario, quiero buscar en mis documentos archivados por significado («la factura de la instalación eléctrica»).

- **AC4.1** ✅ `/search` devuelve los documentos más relevantes con el fragmento fuente resaltado (`<mark>` sobre matches, normalización sin acentos).
- **AC4.2** ✅ Filtros por tipo de documento y fecha (from/to). El padre acompaña a sus hijos con `similarity: null`.

### US5 · Chat con citas (M2 — ✅ hecho 2026-10-04)

> Como usuario, quiero preguntarle a DocuMind sobre mis documentos y recibir respuestas que citen la fuente.

- **AC5.1** ✅ El chat responde **exclusivamente** con contexto recuperado (chunks pgvector, limit 6); nada inventado.
- **AC5.2** ✅ Cada dato de la respuesta lleva **cita clicable** a la ficha del documento fuente (híbridas: `[n]` validado con fallback al contexto completo).
- **AC5.3** ✅ Respuesta en streaming SSE (token a token); modelo de chat `qwen/qwen3.8-27b:free`.

### US6 · Configuración (M2 — ✅ hecho 2026-10-04)

> Como usuario, quiero agregar mi API key de OpenRouter desde la UI y elegir los modelos de visión/embedding/chat.

- **AC6.1** ✅ La clave se guarda **cifrada** (AES-256-GCM + `DOCUMIND_MASTER_KEY`) en BD; la UI solo ve una máscara `••••6d9b`.
- **AC6.2** ✅ El selector de modelos lista los modelos gratuitos vigentes del catálogo de OpenRouter (`provider.listModels` filtrado por modality); la elección se persiste en BD (`model_config`, UNIQUE 0001) y el health la refleja.

### US7 · Idioma · US8 · Tema ✅ (M1)

- **AC7.1** ✅ i18n `es` (default) / `en` en todo texto visible (las etiquetas de columnas del grid viven en `DOC_TYPE_TABLE_SCHEMA` — en español; versionarlas a `en` se evaluará en M2).
- **AC8.1** ✅ Tema claro (base) / oscuro con toggle.

## 7. Requisitos funcionales

- **RF1** Upload drag & drop + clic; validación MIME/tamaño.
- **RF2** Vista previa del original (imagen inline; PDF multi-página con pdf.js).
- **RF3** OCR vía LLM de visión con salida estructurada (JSON Schema ← Zod) y confianza.
- **RF4** Ficha editable por documento (páginas agregadas) con confirmación completa.
- **RF5** Auditoría LLM-vs-humano por campo y por versión.
- **RF6** Embedding al confirmar: chunk padre (texto natural del documento) + chunks hijos por ítem.
- **RF7** Re-embed al editar un documento archivado.
- **RF8** Búsqueda semántica con filtros (tipo, fecha).
- **RF9** Chat grounded (contexto exclusivo) con citas clicables y streaming.
- **RF10** Configuración: API key cifrada, catálogo free, modelos por propósito (visión / embedding / chat).
- **RF11** i18n es/en · **RF12** tema claro/oscuro.

## 8. Requisitos no funcionales

- **RNF1 Estable** ✅ — extracción síncrona con estados visibles (pendiente → leyendo → listo/error), **reintentos con backoff + jitter** ante rate limits del tier free; concurrencia resuelta con **semáforo en memoria de 1 extracción** (decisión 13: uso personal; cola persistente en BD queda fuera de alcance M1).
- **RNF2 Rápida** ✅ — extracción real medida 7.1 s en 1 página (< 10 s/página); confirmación con 3 embeddings en 1 s; búsqueda < 1 s local (verificado en M2 con `tookMs` y gate e2e).
- **RNF3 Eficiente** ✅ — solo modelos free; 1 embedding padre + N hijos por documento (2048 dims verificadas contra Nemotron real).
- **RNF4 Privacidad** ✅ — los archivos permanecen en disco local (`uploads/`); solo las páginas se envían al LLM elegido.
- **RNF5 Seguridad** ✅ — **M1**: API key solo por entorno/`.env` (decisión 11); **M2**: AES-256-GCM en BD con UI de Configuración, prioridad BD > env > fake, `DOCUMIND_MASTER_KEY` exigida al guardar. Nunca en logs ni frontend.
- **RNF6 Accesibilidad** — contraste AA, foco visible, teclado.
- **RNF7 Calidad** — TypeScript strict; lint/typecheck/tests como gates.

## 9. Modelos por defecto (tier free OpenRouter, configurables en BD desde la UI)

| Propósito    | Modelo                     | Slug                                          |
| ------------ | -------------------------- | --------------------------------------------- |
| OCR / visión | Qwen3.8 27B (free)         | `qwen/qwen3.8-27b:free`                       |
| Embeddings   | Nemotron 3 Embed 1B (free) | `nvidia/nemotron-3-embed-1b:free` (2048 dims) |
| Chat         | Qwen3.8 27B (free)         | `qwen/qwen3.8-27b:free`                       |

## 10. Decisiones de producto (grill-me 2026-09-26)

1. RAG completo **+ chat** con citas · 2. Confirmación **por documento** con auditoría por campo · 3. Embedding **padre + hijos por ítem** · 4. **Todo editable** (incluido doc_type) · 5. **Re-embed** al editar archivados · 6. Ficha **por documento** en multi-página · 7. Chat **grounded con citas** · 8. **Sync + backoff** para estabilidad.

## 11. Métricas de éxito

- Ingesta confirmada → archivada + embedado en < 15 s (1 página).
- 0 claves en texto plano; 100% de documentos con auditoría LLM-vs-humano.
- Respuestas del chat con cita trazable en el 100% de los casos.

## 12. Riesgos

| Riesgo                                  | Impacto | Mitigación                                                                            |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| Rate limits / modelos free retirados    | Alto    | Catálogo dinámico + UI de configuración; adapter de proveedor (NIM, etc.); backoff    |
| OCR con errores o campos alucinados     | Medio   | El humano valida en el formulario (HITL); confianza visible por campo; validación Zod |
| PDFs escaneados/dañados                 | Medio   | Conversión página→imagen por página; error por página                                 |
| Embeddings desincronizados tras edición | Medio   | Re-embed transaccional en cada guardado                                               |
