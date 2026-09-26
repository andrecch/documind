# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Profesional independiente hispanohablante (LatAm) que digitaliza sus propios documentos — facturas, contratos, recibos, documentación y propuestas — de forma esporádica y sin ayuda de nadie, desde un escritorio de oficina de día: luz ambiente, pantalla normal, uso intermitente entre otras tareas.

## Product Purpose

DocuMind convierte imágenes y PDFs de documentos en JSON estructurado: un LLM de visión de tier gratuito (OpenRouter) detecta el tipo de documento (factura, contrato, recibo, documentación, propuesta) y extrae sus campos, que se muestran en pantalla. El éxito es que un documento subido produzca un JSON confiable, legible y copiable en segundos, sin fricción y sin pagar herramientas enterprise.

## Positioning

Extracción de documentos con LLM de visión 100% gratuita (variantes :free de OpenRouter), con API key y modelos gestionables desde la propia app, persistencia local (Postgres 16 + pgvector) y privacidad: los archivos permanecen en el servidor propio. Un servicio de pago no puede copiar honestamente el posicionamiento "tier free + local-first".

## Operating Context

- Escena física: escritorio de oficina iluminado de día; la pantalla no es la única fuente de luz; sesión esporádica, no maratón diaria.
- Documentos típicos: facturas de proveedores, contratos, recibos, documentación técnica, propuestas; fotos de cámara o escaneos; los documentos están en español.
- Flujo de producto: Subir (drag & drop clickeable + vista previa) → Revisión (documento a la izquierda, JSON a la derecha).
- Infraestructura factual: monorepo pnpm/Turborepo · Next.js 15 · Postgres 16 + pgvector en Docker · modelos por defecto `qwen/qwen3.8-27b:free` (visión) y `nvidia/nemotron-3-embed-1b:free` (embeddings), seleccionables desde la app.

## Capabilities and Constraints

- Acepta JPG/PNG/WEBP/PDF ≤ 20 MB; validación compartida (Zod) entre frontend y backend.
- El catálogo free de OpenRouter cambia con frecuencia: los modelos son configuración en BD, editables desde la UI; el proveedor vive detrás de la interfaz `LLMProvider` (NIM u otros, plug-and-play).
- La API key se guarda cifrada (AES-256-GCM) en BD; la UI solo ve una máscara.
- Sin autenticación en el MVP. Archivos en disco local (volumen Docker).
- Todo texto visible pasa por i18n `es`/`en` (next-intl), español por defecto.
- Búsqueda semántica por embeddings planificada (M2/M3); no es parte del alcance actual.

## Brand Commitments

- El nombre **DocuMind** es un compromiso fijo.
- El tema base del mundo es **claro** (escena: oficina de día); el modo oscuro es derivado secundario y el toggle dark/light sobrevive como capacidad.
- El JSON extraído es el contenido estrella de la pantalla de Revisión.

## Evidence on Hand

- UI M0 existente y funcional (mundo "Dark Aurora", a reemplazar en rediseño): 2 pantallas, e2e Playwright en verde, tokens en `apps/web/src/app/globals.css`, artboards previos en `openpencil/`.
- Sin testimonios, clientes, benchmarks ni métricas reales: nada de esto puede fabricarse.

## Product Principles

1. Confianza por transparencia: documento y datos juntos, siempre visibles el uno junto al otro.
2. Cero fricción para uso esporádico: el camino corto (soltar → leer) manda sobre la densidad.
3. Transparencia de máquina: decir qué modelo leyó, con cuánta confianza, es parte de la UI.
4. Privacidad local como promesa visible, no letra pequeña.
5. El mundo visual nace de la papelería administrativa real del usuario, no de la estética genérica "AI".
