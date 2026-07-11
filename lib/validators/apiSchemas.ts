import { z } from 'zod';
import {
  utmCoordinateSchema,
  colindanciaSchema,
  dimensionesSchema,
  propietarioSchema,
  loteMetadataSchema,
  planoConfigSchema,
  contextoSchema,
  arcoMetadataSchema,
} from './schemas';

// Schema para generar planos (request de API)
export const generarPlanosSchema = z.object({
  vertices: z.array(utmCoordinateSchema).min(3, 'Se requieren al menos 3 vértices'),
  // Metadata de lados curvos del polígono principal (ver x_geometry_arcos en Odoo).
  arcos: z.array(arcoMetadataSchema).optional(),
  dimensiones: dimensionesSchema,
  lote: loteMetadataSchema,
  colindancias: z.array(colindanciaSchema),
  propietario: propietarioSchema.optional(),
  config: planoConfigSchema.partial().optional(),
  contexto: contextoSchema.optional(),
  imagenContexto: z.object({
    tipo: z.string(),
    data: z.string(),
  }).optional(),
});

// Schema para listar planos (query params)
export const listPlanosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  loteCodigo: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'loteCodigo']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Schema para obtener un plano por ID
export const getPlanoParamsSchema = z.object({
  id: z.string().cuid(),
});

// Schema para crear API key
export const createApiKeySchema = z.object({
  name: z.string().min(3).max(100),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

// Schema para validar API key
export const validateApiKeySchema = z.object({
  apiKey: z.string().startsWith('plpro_'),
});

// Schema para revocar API key
export const revokeApiKeySchema = z.object({
  keyId: z.string().cuid(),
});

// Type exports para uso en rutas
export type GenerarPlanosInput = z.infer<typeof generarPlanosSchema>;
export type ListPlanosQuery = z.infer<typeof listPlanosQuerySchema>;
export type GetPlanoParams = z.infer<typeof getPlanoParamsSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type ValidateApiKeyInput = z.infer<typeof validateApiKeySchema>;
export type RevokeApiKeyInput = z.infer<typeof revokeApiKeySchema>;
