/**
 * Sistema de Coordenadas Relativas para Editor CAD
 * Convierte entre coordenadas geográficas (Lat/Lng) y coordenadas relativas del canvas (metros)
 */

export interface CoordinateSystem {
  // Punto de origen geográfico (esquina seleccionada del terreno)
  origin: {
    lat: number;
    lng: number;
  };
  
  // Configuración
  scale: number; // metros por unidad de canvas (default: 1)
  rotation: number; // radianes, 0 = Norte arriba
  
  // Estado
  isSet: boolean;
}

// Radio de la Tierra en metros
const EARTH_RADIUS = 6371000;

/**
 * Convierte grados a radianes
 */
function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

/**
 * Convierte radianes a grados
 */
function toDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

/**
 * Convierte una diferencia de latitud en metros
 * Aproximación para distancias cortas (<10km)
 */
function latitudeToMeters(latDiff: number): number {
  return latDiff * 111320; // 1 grado de latitud ≈ 111.32 km
}

/**
 * Convierte metros a diferencia de latitud
 */
function metersToLatitude(meters: number): number {
  return meters / 111320;
}

/**
 * Convierte una diferencia de longitud en metros
 * Depende de la latitud (la Tierra es una esfera)
 */
function longitudeToMeters(lngDiff: number, atLatitude: number): number {
  const latRad = toRadians(atLatitude);
  return lngDiff * 111320 * Math.cos(latRad);
}

/**
 * Convierte metros a diferencia de longitud
 */
function metersToLongitude(meters: number, atLatitude: number): number {
  const latRad = toRadians(atLatitude);
  return meters / (111320 * Math.cos(latRad));
}

/**
 * Aplica rotación a un punto (en metros)
 */
function rotatePoint(x: number, y: number, rotation: number): { x: number; y: number } {
  if (rotation === 0) return { x, y };
  
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos
  };
}

/**
 * Aplica rotación inversa a un punto
 */
function rotatePointInverse(x: number, y: number, rotation: number): { x: number; y: number } {
  return rotatePoint(x, y, -rotation);
}

/**
 * Convierte coordenadas relativas del canvas (metros desde origen) a coordenadas geográficas
 * 
 * @param relativePoint - Punto en metros relativos [x, y] desde el origen
 * @param coordSystem - Sistema de coordenadas configurado
 * @returns [latitude, longitude]
 */
export function relativeToGeo(
  relativePoint: [number, number],
  coordSystem: CoordinateSystem
): [number, number] {
  if (!coordSystem.isSet) {
    throw new Error('Coordinate system not initialized. Set origin first.');
  }
  
  const [relX, relY] = relativePoint;
  
  // 1. Aplicar escala
  const scaledX = relX * coordSystem.scale;
  const scaledY = relY * coordSystem.scale;
  
  // 2. Aplicar rotación
  const rotated = rotatePoint(scaledX, scaledY, coordSystem.rotation);
  
  // 3. Convertir metros a offset geográfico
  const latOffset = metersToLatitude(rotated.y);
  const lngOffset = metersToLongitude(rotated.x, coordSystem.origin.lat);
  
  // 4. Sumar al origen
  return [
    coordSystem.origin.lat + latOffset,
    coordSystem.origin.lng + lngOffset
  ];
}

/**
 * Convierte coordenadas geográficas a coordenadas relativas del canvas
 * 
 * @param geoPoint - Punto geográfico [latitude, longitude]
 * @param coordSystem - Sistema de coordenadas configurado
 * @returns [x, y] en metros relativos desde el origen
 */
export function geoToRelative(
  geoPoint: [number, number],
  coordSystem: CoordinateSystem
): [number, number] {
  if (!coordSystem.isSet) {
    throw new Error('Coordinate system not initialized. Set origin first.');
  }
  
  const [lat, lng] = geoPoint;
  
  // 1. Calcular offset desde origen
  const latOffset = lat - coordSystem.origin.lat;
  const lngOffset = lng - coordSystem.origin.lng;
  
  // 2. Convertir a metros
  const metersY = latitudeToMeters(latOffset);
  const metersX = longitudeToMeters(lngOffset, coordSystem.origin.lat);
  
  // 3. Aplicar rotación inversa
  const rotated = rotatePointInverse(metersX, metersY, coordSystem.rotation);
  
  // 4. Aplicar escala inversa
  return [
    rotated.x / coordSystem.scale,
    rotated.y / coordSystem.scale
  ];
}

/**
 * Calcula la distancia en metros entre dos puntos geográficos
 * Usa la fórmula de Haversine
 */
export function calculateGeoDistance(
  point1: [number, number],
  point2: [number, number]
): number {
  const [lat1, lng1] = point1;
  const [lat2, lng2] = point2;
  
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS * c;
}

/**
 * Calcula el centro geográfico (centroide) de un conjunto de puntos
 */
export function calculateGeoCentroid(points: [number, number][]): [number, number] {
  if (points.length === 0) {
    throw new Error('Cannot calculate centroid of empty array');
  }
  
  const sum = points.reduce((acc, [lat, lng]) => {
    return [acc[0] + lat, acc[1] + lng];
  }, [0, 0]);
  
  return [sum[0] / points.length, sum[1] / points.length];
}

/**
 * Crea un sistema de coordenadas con valores por defecto
 */
export function createCoordinateSystem(
  origin?: { lat: number; lng: number }
): CoordinateSystem {
  return {
    origin: origin || { lat: 0, lng: 0 },
    scale: 1, // 1 metro = 1 unidad de canvas
    rotation: 0, // Norte arriba
    isSet: !!origin
  };
}

/**
 * Valida que un punto esté dentro de un rango razonable desde el origen
 * Útil para detectar errores de entrada
 */
export function validatePointDistance(
  point: [number, number],
  coordSystem: CoordinateSystem,
  maxDistanceMeters: number = 10000
): { valid: boolean; distance: number; message?: string } {
  if (!coordSystem.isSet) {
    return { valid: false, distance: 0, message: 'Coordinate system not set' };
  }
  
  const distance = calculateGeoDistance(
    [coordSystem.origin.lat, coordSystem.origin.lng],
    point
  );
  
  if (distance > maxDistanceMeters) {
    return {
      valid: false,
      distance,
      message: `Point is ${distance.toFixed(0)}m from origin (max: ${maxDistanceMeters}m)`
    };
  }
  
  return { valid: true, distance };
}
