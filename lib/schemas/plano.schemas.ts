import { z } from 'zod';

/**
 * ESQUEMAS DE VALIDACIÓN - PROYECTO TERRA LIMA (API V2)
 * Adaptado para soportar el flujo híbrido de generación de planos:
 * - Coordenadas Vectoriales [x,y]
 * - Colindancias detalladas (Texto legal)
 * - Contexto Visual (Vectores o Imagen Base64)
 */

// ==========================================
// TIPOS PARA EL STORE (FRONTEND LEGACY)
// ==========================================

export interface Vertice {
  id: string;
  x: number;
  y: number;
}

export interface MembreteData {
  proyecto: string;
  plano: string;
  profesional: string;
  registro: string;
  fecha: string;
  lamina: string;
  escala: string;
}

export interface Dimensiones {
  frente: number;
  fondo: number;
  izquierda: number;
  derecha: number;
  ladoDerecho: number;
  ladoIzquierdo: number;
  area: number;
  perimetro: number;
}

export interface Colindantes {
  frente: string;
  fondo: string;
  izquierda: string;
  derecha: string;
}

export interface LoteVecino {
  id: string;
  nombre: string;
  vertices: Vertice[];
}

export interface LoteData {
  loteId: string;
  propietario: string;
  dimensiones: Dimensiones;
  colindantes: Colindantes;
  membrete: MembreteData;
  vertices: Vertice[];
  contexto: {
    vecinos: LoteVecino[];
  };
  config: {
    usarGoogleMaps: boolean;
  };
}

// ==========================================
// ESQUEMAS API V2 (ZOD)
// ==========================================

// 1. Coordenadas Simples [x, y]
// Reemplaza al antiguo objeto {id, x, y} para ser compatible con la data pura de GeoJSON/Leaflet
export const VerticeCoordenadaSchema = z.tuple([
  z.number().finite(),
  z.number().finite()
]);

export type VerticeCoordenada = z.infer<typeof VerticeCoordenadaSchema>;

// 2. Dimensiones del Lote
export const DimensionesSchema = z.object({
  frente: z.number().nonnegative('El frente debe ser positivo'),
  fondo: z.number().nonnegative('El fondo debe ser positivo'),
  ladoDerecho: z.number().nonnegative('El lado derecho debe ser positivo'),
  ladoIzquierdo: z.number().nonnegative('El lado izquierdo debe ser positivo'),
  area: z.number().positive('El área debe ser mayor a 0'),
  perimetro: z.number().positive('El perímetro debe ser mayor a 0'),
});

export type DimensionesCalculadas = z.infer<typeof DimensionesSchema>;

// 3. Colindancias (Nuevo formato: Array Detallado)
// Sirve para generar la Memoria Descriptiva textualmente
export const ColindanciaItemSchema = z.object({
  lado: z.enum(['FRENTE', 'FONDO', 'IZQUIERDA', 'DERECHA', 'NORTE', 'SUR', 'ESTE', 'OESTE'])
    .or(z.string()), // Flexible si envían mayúsculas/minúsculas
  tipo: z.string(), // "calle", "lote", "via", "area_verde", "parque"
  nombre: z.string().min(1, 'El nombre del colindante es requerido'), 
  propietario: z.string().optional().nullable(),
  longitud: z.number().optional()
});

export type ColindanciaItem = z.infer<typeof ColindanciaItemSchema>;

// 4. Contexto Vectorial (Prioridad 1)
// Elementos visuales (vecinos, parques) para dibujar en el plano
export const ElementoContextoSchema = z.object({
  tipo: z.enum(['LOTE', 'AREA_VERDE', 'VIA', 'OTRO']).default('LOTE'),
  codigo: z.string().optional(),
  texto: z.string().optional(), // El texto a rotular (Ej: "13", "Parque")
  estado: z.string().optional(),
  vertices: z.array(VerticeCoordenadaSchema)
});

export const ContextoSchema = z.object({
  radioBusqueda: z.number().optional(),
  elementos: z.array(ElementoContextoSchema).default([])
});

export type Contexto = z.infer<typeof ContextoSchema>;

// 5. Imagen de Contexto (Prioridad 2)
// Captura de pantalla enviada desde el frontend (Leaflet)
export const ImagenContextoSchema = z.object({
  tipo: z.literal('captura_pantalla'),
  data: z.string().startsWith('data:image', 'Debe ser una imagen Base64 válida (data:image/...)')
});

export type ImagenContexto = z.infer<typeof ImagenContextoSchema>;

// 6. Configuración de Generación
export const ConfigPlanoSchema = z.object({
  incluirMemoriaDescriptiva: z.boolean().default(true),
  incluirPlanoPerimetrico: z.boolean().default(true),
  incluirPlanoUbicacion: z.boolean().default(true),
  // Formatos
  formatoPapel: z.enum(['A4', 'A3', 'A2', 'A1']).default('A3'),
  orientacion: z.enum(['portrait', 'landscape']).default('landscape'),
  escala: z.string().optional(), // Ej: "1/500"
  incluirColindantesEnPlano: z.boolean().default(true),
  // Formatos específicos por documento (opcional)
  formatosPersonalizados: z.object({
    memoriaDescriptiva: z.object({ formato: z.string(), orientacion: z.enum(['portrait', 'landscape']) }).optional(),
    planoPerimetrico: z.object({ formato: z.string(), orientacion: z.enum(['portrait', 'landscape']) }).optional(),
    planoUbicacion: z.object({ formato: z.string(), orientacion: z.enum(['portrait', 'landscape']) }).optional(),
  }).optional()
});

export type PlanoConfig = z.infer<typeof ConfigPlanoSchema>;

// 7. Información del Lote
export const InfoLoteSchema = z.object({
  codigo: z.string().min(1, 'Código de lote requerido'),
  nombre: z.string(),
  manzana: z.string(),
  etapa: z.string(),
  numeroLote: z.string(),
  estado: z.string().optional(),
  precio: z.number().optional(),
  fechaRegistro: z.string().optional(),
  ubicacion: z.object({
    departamento: z.string().default('Lima'),
    provincia: z.string().default('Lima'),
    distrito: z.string().default('San Juan de Lurigancho'),
    urbanizacion: z.string().optional(),
    direccion: z.string().optional()
  }).optional()
});

export type InfoLote = z.infer<typeof InfoLoteSchema>;

// 8. Información del Propietario
export const PropietarioSchema = z.object({
  nombre: z.string().min(1, 'Nombre de propietario requerido'),
  dni: z.string().nullable().optional(),
  ruc: z.string().nullable().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional()
});

export type Propietario = z.infer<typeof PropietarioSchema>;

// ==========================================
// SCHEMA PRINCIPAL (PAYLOAD DE LA API)
// ==========================================
export const generarPlanosSchema = z.object({
  lote: InfoLoteSchema,
  
  // Geometría Principal
  vertices: z.array(VerticeCoordenadaSchema).min(3, 'El polígono debe tener al menos 3 vértices'),
  dimensiones: DimensionesSchema,
  
  // Información Legal/Textual
  colindancias: z.array(ColindanciaItemSchema),
  
  // Información del Propietario
  propietario: PropietarioSchema.nullable().optional(),
  
  // Contexto Híbrido (Prioridades)
  contexto: ContextoSchema.optional(),                        // Prioridad 1: Vectores
  imagenContexto: ImagenContextoSchema.nullable().optional(), // Prioridad 2: Imagen Base64
  
  // Configuración Técnica
  config: ConfigPlanoSchema.optional()
});

// Tipo exportado para usar en el backend (NextRequest)
export type GenerarPlanosRequest = z.infer<typeof generarPlanosSchema>;

// Helpers de validación (opcional, para mantener compatibilidad con tu código existente)
export const validateLoteData = (data: unknown) => {
  return generarPlanosSchema.safeParse(data);
};