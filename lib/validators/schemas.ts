import { z } from 'zod';
import { UTM_ZONES } from '@/lib/constants/plano';

// Coordenada UTM
export const utmCoordinateSchema = z.tuple([z.number(), z.number()]);

// Zona UTM válida para Perú (17S/18S/19S, hemisferio sur). Si se omite, los
// generadores asumen 18 (lib/geometry/utmUtils.ts DEFAULT_UTM_ZONE).
export const zonaUTMSchema = z.union([
  z.literal(UTM_ZONES.PERU_NORTH),
  z.literal(UTM_ZONES.PERU_CENTER),
  z.literal(UTM_ZONES.PERU_SOUTH),
]);

// Colindancia
export const colindanciaSchema = z.object({
  lado: z.enum(['norte', 'sur', 'este', 'oeste', 'frente', 'fondo', 'derecha', 'izquierda', 'FRENTE', 'FONDO', 'DERECHA', 'IZQUIERDA', 'NORTE', 'SUR', 'ESTE', 'OESTE']),
  tipo: z.enum(['lote', 'calle', 'area_verde', 'area_comun']),
  nombre: z.string(),
  propietario: z.string().optional(),
  longitud: z.number().optional(),
  coordinates: z.array(utmCoordinateSchema).optional(),
});

// Dimensiones
export const dimensionesSchema = z.object({
  frente: z.number().positive(),
  fondo: z.number().positive(),
  ladoDerecho: z.number().positive(),
  ladoIzquierdo: z.number().positive(),
  area: z.number().positive(),
  perimetro: z.number().positive(),
});

// Propietario
export const propietarioSchema = z.object({
  nombre: z.string(),
  dni: z.string().nullable().optional(),
  ruc: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
});

// Lote Metadata
export const loteMetadataSchema = z.object({
  codigo: z.string(),
  nombre: z.string(),
  manzana: z.string(),
  etapa: z.string(),
  numeroLote: z.string(),
  estado: z.enum(['libre', 'separado', 'vendido']),
  precio: z.number().optional(),
  fechaRegistro: z.string().optional(),
  ubicacion: z.object({
    departamento: z.string().optional(),
    provincia: z.string().optional(),
    distrito: z.string().optional(),
    urbanizacion: z.string().optional(),
    direccion: z.string().optional(),
    zonaUTM: zonaUTMSchema.optional(),
  }).optional(),
});

// Plano Config
export const planoConfigSchema = z.object({
  incluirMemoriaDescriptiva: z.boolean().default(true),
  incluirPlanoPerimetrico: z.boolean().default(true),
  incluirPlanoUbicacion: z.boolean().default(true),
  formatoPapel: z.enum(['A4', 'A3', 'Legal']).default('A4'),
  orientacion: z.enum(['portrait', 'landscape']).default('portrait'),
  escala: z.string().optional(),
  incluirColindantesEnPlano: z.boolean().default(true),
  logoUrl: z.string().url().optional(),
});

// Lote Vecino
export const loteVecinoSchema = z.object({
  codigo: z.string(),
  vertices: z.array(utmCoordinateSchema),
  estado: z.string(),
  tipo: z.string().optional(),
  texto: z.string().optional(),
});

// Contexto
export const contextoSchema = z.object({
  lotesVecinos: z.array(loteVecinoSchema).optional(),
  radioBusqueda: z.number().optional(),
  elementos: z.array(loteVecinoSchema).optional(),
});
