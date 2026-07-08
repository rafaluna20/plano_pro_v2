import proj4 from 'proj4';
import { UTMCoordinate } from '@/types/planos';

const WGS84 = 'EPSG:4326'; // Lat/Lng

/**
 * Zona UTM por defecto. Perú completo abarca las zonas 17S (extremo norte,
 * ej. Tumbes/Piura), 18S (la gran mayoría del país, incluye Lima) y 19S
 * (extremo sur, ej. Tacna) — todas en el hemisferio sur. 18 cubre el 100%
 * del tráfico actual (proyectos en Lima), por eso es el default seguro
 * para no romper compatibilidad con payloads que no especifiquen zona.
 */
export const DEFAULT_UTM_ZONE = 18;

/**
 * Construye el string proj4 para una zona UTM del hemisferio sur peruano.
 *
 * Única fuente de verdad para esta proyección: antes esta misma cadena
 * vivía copiada de forma independiente y fija en zona 18 en 5 archivos
 * (aquí, lib/constants/plano.ts, app/api/v1/planos/print/route.ts,
 * app/page.tsx, app/utils/geometry.ts) — cualquier proyecto fuera de zona
 * 18S habría requerido editar los 5 en paralelo, y encima ninguno lo
 * permitía parametrizar. Ahora todos importan esta función.
 */
export function getUtmProjString(zone: number = DEFAULT_UTM_ZONE): string {
  return `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`;
}

/**
 * Convierte coordenadas UTM a Lat/Lng
 */
export function utmToLatLng(utm: UTMCoordinate, zone: number = DEFAULT_UTM_ZONE): [number, number] {
  const [lng, lat] = proj4(getUtmProjString(zone), WGS84, utm);
  return [lat, lng];
}


/**
 * Convierte coordenadas Lat/Lng a UTM
 */
export function latLngToUtm(lat: number, lng: number, zone: number = DEFAULT_UTM_ZONE): UTMCoordinate {
  const [x, y] = proj4(WGS84, getUtmProjString(zone), [lng, lat]);
  return [x, y];
}

/**
 * Calcula el centroide de un polígono
 */
export function calculateCentroid(vertices: UTMCoordinate[]): UTMCoordinate {
  const n = vertices.length;
  let sumX = 0;
  let sumY = 0;

  for (const [x, y] of vertices) {
    sumX += x;
    sumY += y;
  }

  return [sumX / n, sumY / n];
}

/**
 * Calcula el área de un polígono usando la fórmula del shoelace
 */
export function calculateArea(vertices: UTMCoordinate[]): number {
  const n = vertices.length;
  let area = 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i][0] * vertices[j][1];
    area -= vertices[j][0] * vertices[i][1];
  }

  return Math.abs(area / 2);
}

/**
 * Calcula el perímetro de un polígono
 */
export function calculatePerimeter(vertices: UTMCoordinate[]): number {
  const n = vertices.length;
  let perimeter = 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = vertices[j][0] - vertices[i][0];
    const dy = vertices[j][1] - vertices[i][1];
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return perimeter;
}

/**
 * Calcula la distancia entre dos puntos
 */
export function calculateDistance(p1: UTMCoordinate, p2: UTMCoordinate): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calcula el ángulo de un segmento (en grados)
 */
export function calculateBearing(p1: UTMCoordinate, p2: UTMCoordinate): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return (angle + 360) % 360;
}

/**
 * Calcula los ángulos internos de un polígono simple, uno por vértice, en el
 * mismo orden que `vertices` (sin el punto de cierre).
 *
 * No asume el sentido de recorrido (horario/antihorario): determina la
 * orientación real a partir del signo del área firmada (shoelace) del propio
 * arreglo recibido, así que funciona igual en coordenadas UTM (Y hacia el
 * norte) que en coordenadas de papel/pantalla (Y invertido) sin necesitar dos
 * fórmulas distintas. La suma de los ángulos retornados siempre da (n-2)*180.
 *
 * Antes existían 3-4 implementaciones divergentes de este cálculo en el
 * proyecto; una de ellas (ver git history de PlanoDataProcessor.ts) asumía
 * sentido antihorario fijo y devolvía el ángulo reflejo (ej. 270° en vez de
 * 90°) cuando el polígono venía en sentido horario. Todos los consumidores
 * deben usar esta función en vez de recalcular el ángulo por su cuenta.
 */
export function calculateInteriorAngles(vertices: UTMCoordinate[]): number[] {
  const n = vertices.length;
  if (n < 3) {
    throw new Error('Se requieren al menos 3 vértices para calcular ángulos internos');
  }

  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = vertices[i];
    const [x2, y2] = vertices[(i + 1) % n];
    signedArea += x1 * y2 - x2 * y1;
  }
  const isPositiveWinding = signedArea > 0;

  return vertices.map((p, i) => {
    const prev = vertices[(i - 1 + n) % n];
    const next = vertices[(i + 1) % n];

    const aPrev = Math.atan2(prev[1] - p[1], prev[0] - p[0]);
    const aNext = Math.atan2(next[1] - p[1], next[0] - p[0]);

    let angleRad = isPositiveWinding ? aPrev - aNext : aNext - aPrev;
    if (angleRad < 0) angleRad += Math.PI * 2;

    return angleRad * (180 / Math.PI);
  });
}

/**
 * Obtiene el bounding box de un conjunto de vértices
 */
export function getBoundingBox(vertices: UTMCoordinate[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  const xs = vertices.map(v => v[0]);
  const ys = vertices.map(v => v[1]);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Normaliza vertices para centrarlos en el origen
 */
export function normalizeVertices(vertices: UTMCoordinate[]): UTMCoordinate[] {
  const centroid = calculateCentroid(vertices);
  return vertices.map(([x, y]) => [
    x - centroid[0],
    y - centroid[1]
  ]);
}

/**
 * Rota vértices alrededor del origen
 */
export function rotateVertices(vertices: UTMCoordinate[], angleDegrees: number): UTMCoordinate[] {
  const angleRad = angleDegrees * (Math.PI / 180);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return vertices.map(([x, y]) => [
    x * cos - y * sin,
    x * sin + y * cos
  ]);
}
