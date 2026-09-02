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

// Metadata de un lado curvo (arco de circunferencia). sentido: hacia qué
// lado se abomba el arco caminando del vértice/extremo inicial al final.
export const sentidoArcoSchema = z.enum(['horario', 'antihorario']);

export const arcoMetadataSchema = z.object({
  indiceVertice: z.number().int().min(0),
  radio: z.number().positive(),
  longitudArco: z.number().positive(),
  sentido: sentidoArcoSchema,
});

// Colindancia
export const colindanciaSchema = z.object({
  lado: z.enum(['norte', 'sur', 'este', 'oeste', 'frente', 'fondo', 'derecha', 'izquierda', 'FRENTE', 'FONDO', 'DERECHA', 'IZQUIERDA', 'NORTE', 'SUR', 'ESTE', 'OESTE']),
  // Antes era z.enum(['lote','calle','area_verde','area_comun']) — un enum
  // fijo que rechazaba (400) cualquier colindancia contra una capa dinámica
  // nueva (agua, lineas, general, o cualquier código creado en Odoo vía
  // elemento.urbano.capa). "tipo" ya no es un catálogo cerrado, así que la
  // validación tampoco debe serlo.
  tipo: z.string(),
  nombre: z.string(),
  propietario: z.string().optional(),
  longitud: z.number().optional(),
  coordinates: z.array(utmCoordinateSchema).optional(),
  // Presentes solo si este lindero es un lado curvo (ver arcoMetadataSchema).
  radio: z.number().positive().optional().nullable(),
  longitudArco: z.number().positive().optional().nullable(),
  sentido: sentidoArcoSchema.optional().nullable(),
});

// Dimensiones
// fondo/ladoDerecho/ladoIzquierdo aceptan 0: el clasificador de lados en
// mapa_renasur (derivarColindanciasYDimensiones) asume un lote más o menos
// cuadrangular con esos 4 lados — un predio/matriz sin subdividir con un
// perímetro muy irregular (muchos vértices, sin las 4 caras clásicas) puede
// legítimamente no tener ningún tramo clasificado como "izquierda", por
// ejemplo. El detalle real lado-por-lado ya viaja completo en
// `colindancias`; estos 4 escalares son solo un resumen, no se usan para
// dibujar el plano (ver MemoriaDescriptiva.ts/PlanoUbicacion.ts, que solo
// leen area/perimetro). `frente` se mantiene positive(): el algoritmo
// siempre le asigna la arista más larga del polígono, nunca puede dar 0.
export const dimensionesSchema = z.object({
  frente: z.number().positive(),
  fondo: z.number().nonnegative(),
  ladoDerecho: z.number().nonnegative(),
  ladoIzquierdo: z.number().nonnegative(),
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
  // Igual riesgo de strip silencioso que el resto de campos de este schema:
  // hay que declarar cada campo nuevo acá o zod lo descarta sin avisar.
  incluirPlanoPerimetricoCopia: z.boolean().optional(),
  soloSeccionLinderosEnMemoria: z.boolean().optional(),
  formatoPapel: z.enum(['A4', 'A3', 'A2', 'A1', 'A0', 'Legal']).default('A4'),
  orientacion: z.enum(['portrait', 'landscape']).default('portrait'),
  escala: z.string().optional(),
  incluirColindantesEnPlano: z.boolean().default(true),
  logoUrl: z.string().url().optional(),
});

// Lote Vecino (también usado para contexto.elementos: calles/áreas verdes/
// agua/líneas/general/capas dinámicas — no solo lotes vecinos)
export const loteVecinoSchema = z.object({
  codigo: z.string(),
  vertices: z.array(utmCoordinateSchema),
  estado: z.string(),
  tipo: z.string().optional(),
  texto: z.string().optional(),
  // Zod .object() por defecto STRIPEA cualquier clave no declarada acá al
  // validar el request — faltaban estos dos campos, así que "color" y
  // "mostrarEtiqueta" llegaban bien desde mapa_renasur pero se perdían
  // silenciosamente en este safeParse, antes de que el adaptador/generador
  // los viera. Eso hacía que el plano cayera al gris de respaldo aunque el
  // payload real (confirmado por logs) sí traía el color correcto.
  // "color" se reemplazó por colorBorde/colorRelleno independientes.
  colorBorde: z.string().optional(),
  colorRelleno: z.string().optional(),
  mostrarEtiqueta: z.boolean().optional(),
  // Mismo riesgo de strip que color/mostrarEtiqueta arriba: hay que declarar
  // cada campo nuevo acá explícitamente o zod lo descarta en silencio.
  esArea: z.boolean().optional(),
  sinRelleno: z.boolean().optional(),
  sinBorde: z.boolean().optional(),
  arcos: z.array(arcoMetadataSchema).optional(),
  circulo: z.object({
    centro: utmCoordinateSchema,
    radio: z.number().positive(),
  }).optional(),
});

// Contexto
export const contextoSchema = z.object({
  lotesVecinos: z.array(loteVecinoSchema).optional(),
  radioBusqueda: z.number().optional(),
  elementos: z.array(loteVecinoSchema).optional(),
});
