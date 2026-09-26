# DocuMind â€” Documento de Requisitos de Producto (PRD)

> Estado: v1.0 Â· 2026-09-26 Â· Fase 0 (documentaciÃ³n) aprobada

## 1. VisiÃ³n

DocuMind es una aplicaciÃ³n web que permite subir imÃ¡genes o PDFs, detectar automÃ¡ticamente el tipo de documento con un **LLM de visiÃ³n** (factura, contrato, recibo, documentaciÃ³n o propuesta) y extraer sus datos en **JSON estructurado**, mostrÃ¡ndolos en pantalla. Todo con proveedores LLM de **tier gratuito** (OpenRouter) y **PostgreSQL + pgvector** para persistencia y futura bÃºsqueda semÃ¡ntica.

## 2. Problema

Los documentos (facturas, contratos, recibos, documentaciÃ³n tÃ©cnica, propuestas) llegan en formatos no estructurados. Extraer sus datos manualmente es lento, propenso a errores y difÃ­cil de escalar. Los servicios de extracciÃ³n de pago son caros para uso individual o de oficina pequeÃ±a.

## 3. Objetivos

- **O1** â€” Subir documentos con drag & drop o clic (explorador de archivos), con vista previa inmediata.
- **O2** â€” Clasificar automÃ¡ticamente el documento entre los 5 tipos soportados.
- **O3** â€” Devolver datos extraÃ­dos en JSON validado (esquema Zod), legibles y copiables.
- **O4** â€” Persistir documentos y extracciones en PostgreSQL; preparar bÃºsqueda semÃ¡ntica con pgvector.
- **O5** â€” Gestionar el proveedor LLM (API key y elecciÃ³n de modelos) desde la propia UI, sin editar `.env`.

## 4. Alcance por fases

| Fase | Contenido | Estado |
|---|---|---|
| **UI inicial** | Monorepo + Docker (Postgres/pgvector) + pantalla de Subida (drag & drop clickeable) + pantalla de RevisiÃ³n (preview izq. + JSON der. con datos de muestra). Sin conexiÃ³n LLM. | â† Fase actual |
| **M1 â€” Pipeline** | Backend NestJS, upload real, clasificaciÃ³n + extracciÃ³n con LLM de visiÃ³n, persistencia en DB | Pendiente |
| **M2 â€” ConfiguraciÃ³n** | Pantalla de ConfiguraciÃ³n (API key cifrada AES-256-GCM en BD, catÃ¡logo de modelos free editable), embeddings + bÃºsqueda semÃ¡ntica pgvector | Pendiente |
| **M3 â€” Historial** | Lista de documentos, filtros por tipo, exportaciÃ³n JSON | Pendiente |

**Fuera de alcance (todas las fases):** OCR local, autenticaciÃ³n multiusuario, facturaciÃ³n, apps mÃ³viles nativas, S3 (el MVP usa disco local via volumen Docker).

## 5. Usuarios

- **Usuario individual u oficina pequeÃ±a** que necesita pasar documentos a datos estructurados sin depender de herramientas enterprise de pago y sin perder privacidad (procesamiento con LLM de tier free; archivos permanecen en el equipo/servidor propio).

## 6. User Stories y criterios de aceptaciÃ³n

### US1 Â· Subir documento (UI inicial)
> Como usuario, quiero arrastrar una imagen o PDF â€” o hacer clic para abrir el explorador de archivos â€” para verlo en vista previa antes de extraer sus datos.

- **AC1.1** Acepta `JPG`, `PNG`, `WEBP` y `PDF` con lÃ­mite de **20 MB**.
- **AC1.2** Al soltar/seleccionar, navega a la pantalla de RevisiÃ³n; el preview ocupa la mitad izquierda.
- **AC1.3** Tipos no admitidos o archivos > 20 MB muestran error claro en el idioma activo (es/en).
- **AC1.4** El dropzone es clickeable (abre el explorador de archivos) ademÃ¡s de receptivo al drag & drop.

### US2 Â· RevisiÃ³n
> Como usuario, quiero ver el documento a la izquierda y los datos extraÃ­dos en JSON a la derecha, con acciones de copiar/descargar.

- **AC2.1** Split-screen 50/50; JSON con resaltado de sintaxis y encabezado con badge del tipo de documento ("FACTURA").
- **AC2.2** BotÃ³n **Copiar** escribe el JSON vÃ¡lido al portapapeles; pie muestra modelo/tokens/confianza (mock en fase UI).
- **AC2.3** imÃ¡genes se muestran directamente; PDFs renderizan su primera pÃ¡gina (pdf.js) con paginador "PÃ¡gina 1 / N".

### US3 Â· Idioma
> Como usuario, quiero cambiar entre EspaÃ±ol e InglÃ©s.

- **AC3.1** Todos los textos visibles pasan por i18n (`es` default, `en`); rutas `/es` y `/en` con redirecciÃ³n desde `/`.

### US4 Â· Tema
> Como usuario, quiero alternar tema oscuro/claro.

- **AC4.1** Dark Aurora por defecto; el light mantiene contraste AA y la misma estructura visual.

### US5 Â· ExtracciÃ³n (M1)
> Como usuario, quiero que el sistema detecte el tipo y extraiga los campos del documento.

- **AC5.1** Resultado validado contra esquema (tipo + confianza 0â€“1); estados visibles: pendiente â†’ procesando â†’ listo/error.
- **AC5.2** Si el proveedor falla o el modelo free no responde, se muestra error recuperable sin perder la vista previa.

### US6 Â· ConfiguraciÃ³n (M2)
> Como usuario, quiero agregar mi API key de OpenRouter desde la UI y elegir los modelos de visiÃ³n/embedding.

- **AC6.1** La clave se guarda **cifrada** (Nunca view; solo mÃ¡scara `â€¢â€¢â€¢â€¢4f2a`).
- **AC6.2** El selector de modelos lista solo modelos gratuitos vigentes (refresco desde catÃ¡logo de OpenRouter); los elegidos se persisten en BD.

## 7. Requisitos funcionales

- **RF1** Upload con drag & drop + clic; validaciÃ³n de MIME y tamaÃ±o.
- **RF2** Vista previa: imagen inline; PDF primera pÃ¡gina con paginador.
- **RF3** Pantalla de revisiÃ³n dividida: preview 50% / JSON 50%.
- **RF4** JSON con resaltado, copiar y descargar `.json`.
- **RF5** ClasificaciÃ³n en 5 tipos: `factura | contrato | recibo | documentacion | propuesta`.
- **RF6** ExtracciÃ³n estructurada validada con esquema compartido (Zod) â†’ JSON.
- **RF7** Persistencia: documentos, extracciones, chunks con embeddings.
- **RF8** ConfiguraciÃ³n de proveedor: API key cifrada, catÃ¡logo de modelos free, modelos por propÃ³sito.
- **RF9** i18n `es`/`en` en todo texto visible.
- **RF10** Tema dark/light persistente (preferencia del sistema como inicial).

## 8. Requisitos no funcionales

- **RNF1 Privacidad** â€” los archivos se quedan en el servidor propio (disco local, volumen Docker); solo se envÃ­an al LLM elegido.
- **RNF2 Seguridad** â€” claves cifradas AES-256-GCM con clave maestra fuera de la BD; nunca en logs ni en el frontend.
- **RNF3 Accesibilidad** â€” contraste â‰¥ 4.5:1 en textos, navegaciÃ³n por teclado, focus visible.
- **RNF4 Calidad** â€” TypeScript strict, lint y typecheck como gates CI locales.
- **RNF5 Resiliencia** â€” degradaciÃ³n elegante ante rate limits o modelos retirados del tier free.

## 9. Modelos por defecto (tier free OpenRouter)

| PropÃ³sito | Modelo | Slug | Detalles |
|---|---|---|---|
| VisiÃ³n OCR | Qwen3.8 27B (free) | `qwen/qwen3.8-27b:free` | VLM denso open-weight (texto+imagen+videoâ†’texto), liberado ago-2026 |
| Embeddings | Nemotron 3 Embed 1B (free) | `nvidia/nemotron-3-embed-1b:free` | `textâ†’embeddings`, vector de **2048 dims** |

Ambos son **seeds de configuraciÃ³n en BD, no constantes de cÃ³digo**: el catÃ¡logo free cambia y la UI permite sustituirlos en cualquier momento (ver `docs/ARCHITECTURE.md` Â§7).

## 10. MÃ©tricas de Ã©xito

- Subida â†’ preview en < 1 s (local).
- ExtracciÃ³n completa (M1): < 10 s por documento de 1 pÃ¡gina.
- 0 claves en texto plano en BD/logs/frontend.
- Cobertura de lint/typecheck sin errores en cada PR.

## 11. Riesgos

| Riesgo | Impacto | MitigaciÃ³n |
|---|---|---|
| OpenRouter retira un modelo `:free` | Alto | CatÃ¡logo dinÃ¡mico + selecciÃ³n desde UI; adapter de proveedor (NIM, etc.) plug-and-play |
| Rate limits del tier free | Medio | Cola de extracciÃ³n, reintentos con backoff, aviso de cuota en UI |
| PDFs escaneados/daÃ±ados | Medio | ConversiÃ³n pÃ¡ginaâ†’imagen por pÃ¡gina + validaciÃ³n previa; error por pÃ¡gina |
| Escapes de JSON del LLM | Medio | response_format JSON Schema + validaciÃ³n Zod + reintento |
