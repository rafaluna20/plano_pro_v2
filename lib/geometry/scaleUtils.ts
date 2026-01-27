import { UTMCoordinate } from '@/types/planos';
import { getBoundingBox } from './utmUtils';

/**
 * Escalas comunes para planos técnicos
 */
export const ESCALAS_COMUNES = {
  '1:100': 100,
  '1:200': 200,
  '1:250': 250,
  '1:500': 500,
  '1:1000': 1000,
  '1:2000': 2000,
  '1:5000': 5000,
} as const;

export type EscalaComun = keyof typeof ESCALAS_COMUNES;

/**
 * Dimensiones de papel en mm
 */
export const PAPEL_DIMENSIONES = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  Legal: { width: 215.9, height: 355.6 },
} as const;

export type FormatoPapel = keyof typeof PAPEL_DIMENSIONES;

/**
 * Calcula la escala óptima para un plano dado el tamaño del papel
 */
export function calcularEscalaOptima(
  vertices: UTMCoordinate[],
  formatoPapel: FormatoPapel,
  orientacion: 'portrait' | 'landscape',
  margen: number = 20 // mm
): { escala: number; escalaTexto: string } {
  const bbox = getBoundingBox(vertices);
  const { width: paperWidth, height: paperHeight } = PAPEL_DIMENSIONES[formatoPapel];

  // Ajustar por orientación
  const areaWidth = orientacion === 'landscape' ? paperHeight : paperWidth;
  const areaHeight = orientacion === 'landscape' ? paperWidth : paperHeight;

  // Área disponible en mm (descontando márgenes)
  const availableWidth = areaWidth - (margen * 2);
  const availableHeight = areaHeight - (margen * 2);

  // Dimensiones del polígono en metros
  const polyWidth = bbox.width;
  const polyHeight = bbox.height;

  // Calcular escalas necesarias para cada dimensión
  const scaleByWidth = polyWidth / (availableWidth / 1000); // Convertir mm a m
  const scaleByHeight = polyHeight / (availableHeight / 1000);

  // Usar la escala mayor (más restrictiva)
  const requiredScale = Math.max(scaleByWidth, scaleByHeight);

  // Redondear a escala común más cercana (superior)
  const escalasFijas = Object.values(ESCALAS_COMUNES).sort((a, b) => a - b);
  const escala = escalasFijas.find(e => e >= requiredScale) || escalasFijas[escalasFijas.length - 1];

  // Encontrar el texto de la escala
  const escalaTexto = Object.entries(ESCALAS_COMUNES)
    .find(([_, val]) => val === escala)?.[0] || `1:${escala}`;

  return { escala, escalaTexto };
}

/**
 * Convierte metros a milímetros en el papel según la escala
 */
export function metrosAPapel(metros: number, escala: number): number {
  return (metros / escala) * 1000; // Resultado en mm
}

/**
 * Convierte coordenadas UTM a coordenadas de papel (mm)
 */
export function utmToPaper(
  vertices: UTMCoordinate[],
  escala: number,
  centerX: number,
  centerY: number
): Array<[number, number]> {
  const bbox = getBoundingBox(vertices);
  const centerUtmX = (bbox.minX + bbox.maxX) / 2;
  const centerUtmY = (bbox.minY + bbox.maxY) / 2;

  return vertices.map(([x, y]) => {
    // Trasladar al origen
    const relX = x - centerUtmX;
    const relY = y - centerUtmY;

    // Escalar y convertir a mm
    const paperX = centerX + metrosAPapel(relX, escala);
    const paperY = centerY - metrosAPapel(relY, escala); // Invertir Y para PDF

    return [paperX, paperY];
  });
}

/**
 * Convierte coordenadas UTM a coordenadas de papel (mm) usando un centroide personalizado
 * Útil para dibujar elementos de contexto relativos al lote principal
 */
export function utmToPaperRelative(
  vertices: UTMCoordinate[],
  centerUtm: [number, number],
  escala: number,
  centerX: number,
  centerY: number
): Array<[number, number]> {
  return vertices.map(([x, y]) => {
    // Trasladar relativo al centroide proporcionado (del lote principal)
    const relX = x - centerUtm[0];
    const relY = y - centerUtm[1];

    // Escalar y convertir a mm
    const paperX = centerX + metrosAPapel(relX, escala);
    const paperY = centerY - metrosAPapel(relY, escala); // Invertir Y para PDF

    return [paperX, paperY];
  });
}

/**
 * Calcula las dimensiones del dibujo en papel
 */
export function getDimensionesEnPapel(
  vertices: UTMCoordinate[],
  escala: number
): { width: number; height: number } {
  const bbox = getBoundingBox(vertices);
  
  return {
    width: metrosAPapel(bbox.width, escala),
    height: metrosAPapel(bbox.height, escala),
  };
}

/**
 * Verifica si el dibujo cabe en el papel con la escala dada
 */
export function cabeEnPapel(
  vertices: UTMCoordinate[],
  escala: number,
  formatoPapel: FormatoPapel,
  orientacion: 'portrait' | 'landscape',
  margen: number = 20
): boolean {
  const dimensiones = getDimensionesEnPapel(vertices, escala);
  const { width: paperWidth, height: paperHeight } = PAPEL_DIMENSIONES[formatoPapel];

  const areaWidth = orientacion === 'landscape' ? paperHeight : paperWidth;
  const areaHeight = orientacion === 'landscape' ? paperWidth : paperHeight;

  const availableWidth = areaWidth - (margen * 2);
  const availableHeight = areaHeight - (margen * 2);

  return dimensiones.width <= availableWidth && dimensiones.height <= availableHeight;
}
