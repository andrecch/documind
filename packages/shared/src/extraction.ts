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
