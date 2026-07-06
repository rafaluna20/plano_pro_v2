/**
 * geometry.ts
 * Utilidades geométricas centralizadas para el Editor de Catastro Urbano.
 * Todas las funciones son puras y testeables.
 */

import proj4 from "proj4";

// ─── Proyecciones ────────────────────────────────────────────────────────────
export const WGS84 = "EPSG:4326";
export const UTM_18S = "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs";

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface Vertice {
  id: string;
  x: number; // UTM Este
  y: number; // UTM Norte
}

export type Orientacion = "NORTE" | "ESTE" | "SUR" | "OESTE";

// ─── Área (Fórmula de Gauss / Shoelace) ─────────────────────────────────────
export const calculatePolygonArea = (vertices: Vertice[]): number => {
  if (vertices.length < 3) return 0;
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Number((Math.abs(area) / 2.0).toFixed(2));
};

// ─── Perímetro ───────────────────────────────────────────────────────────────
export const calculatePerimeter = (vertices: Vertice[]): number => {
  if (vertices.length < 2) return 0;
  let perimeter = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];
    perimeter += Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));
  }
  return Number(perimeter.toFixed(2));
};

// ─── Distancia entre dos vértices ────────────────────────────────────────────
export const distanciaEntre = (v1: Vertice, v2: Vertice): number =>
  Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));

// ─── Orientación cardinal correcta (por brújula UTM) ────────────────────────
/**
 * Calcula la orientación cardinal del segmento v1→v2 basándose en
 * el ángulo real en coordenadas UTM. Funciona para CUALQUIER polígono,
 * no solo rectangulares.
 */
export const calcularOrientacion = (v1: Vertice, v2: Vertice): Orientacion => {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  // atan2 en UTM: +Y es Norte, +X es Este
  const angulo = Math.atan2(dy, dx) * (180 / Math.PI);
  // Convertir a ángulo de brújula (0° = Norte, horario)
  const brujula = (90 - angulo + 360) % 360;

  if (brujula >= 315 || brujula < 45) return "NORTE";
  if (brujula >= 45 && brujula < 135) return "ESTE";
  if (brujula >= 135 && brujula < 225) return "SUR";
  return "OESTE";
};

// ─── Centroide ───────────────────────────────────────────────────────────────
export const calcularCentroide = (
  vertices: Vertice[]
): { x: number; y: number } => {
  if (vertices.length === 0) return { x: 0, y: 0 };
  const cx = vertices.reduce((s, v) => s + v.x, 0) / vertices.length;
  const cy = vertices.reduce((s, v) => s + v.y, 0) / vertices.length;
  return { x: cx, y: cy };
};

// ─── Conversión UTM → LatLng (para Leaflet) ───────────────────────────────
export const utmToLatLng = (x: number, y: number): [number, number] => {
  try {
    const [lng, lat] = proj4(UTM_18S, WGS84, [x, y]);
    if (isNaN(lat) || isNaN(lng)) return [0, 0];
    return [lat, lng];
  } catch {
    return [0, 0];
  }
};

// ─── Conversión LatLng → UTM ─────────────────────────────────────────────
export const latLngToUtm = (lat: number, lng: number): [number, number] => {
  try {
    const [x, y] = proj4(WGS84, UTM_18S, [lng, lat]);
    return [x, y];
  } catch {
    return [0, 0];
  }
};

// ─── Helpers para SVG ────────────────────────────────────────────────────────
export const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) => {
  const angleInRadians = (((angleInDegrees || 0) - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

export const describeArc = (
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string => {
  if (isNaN(x) || isNaN(y) || isNaN(startAngle) || isNaN(endAngle)) return "";
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  let largeArcFlag = "0";
  let diff = endAngle - startAngle;
  while (diff < 0) diff += 360;
  while (diff >= 360) diff -= 360;
  if (diff > 180) largeArcFlag = "1";
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    "L", x, y, "Z",
  ].join(" ");
};

export const getGridStep = (range: number): number => {
  if (!range || range <= 0 || !isFinite(range)) return 5;
  const targetSteps = 5;
  const rawStep = range / targetSteps;
  const power = Math.floor(Math.log10(rawStep));
  const base = rawStep / Math.pow(10, power);
  let niceBase = 1;
  if (base > 5) niceBase = 10;
  else if (base > 2) niceBase = 5;
  else if (base > 1) niceBase = 2;
  const step = niceBase * Math.pow(10, power);
  return isFinite(step) && step > 0 ? step : 5;
};

// ─── Traslación de polígono ──────────────────────────────────────────────────
/**
 * Traslada todos los vértices de un polígono para que su centroide
 * quede en el punto UTM (newUtmX, newUtmY).
 */
export const trasladarVertices = (
  vertices: Vertice[],
  newUtmX: number,
  newUtmY: number
): Vertice[] => {
  const centroid = calcularCentroide(vertices);
  const deltaX = newUtmX - centroid.x;
  const deltaY = newUtmY - centroid.y;
  return vertices.map((v) => ({
    ...v,
    x: parseFloat((v.x + deltaX).toFixed(2)),
    y: parseFloat((v.y + deltaY).toFixed(2)),
  }));
};
