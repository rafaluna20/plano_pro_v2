import { UTMCoordinate } from '@/types/planos';
import { ImportResult } from '@/types/editor';

/**
 * Parsers para importar datos de diferentes formatos
 */

/**
 * Parser para archivos CSV
 * Formato esperado: x,y o este,norte o easting,northing
 */
export function parseCSV(content: string): ImportResult {
  try {
    const lines = content.trim().split('\n');
    if (lines.length < 3) {
      return {
        success: false,
        error: 'El archivo CSV debe tener al menos 3 líneas (header + 2 coordenadas mínimo)'
      };
    }

    const vertices: UTMCoordinate[] = [];
    
    // Detectar si la primera línea es header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('x') || firstLine.includes('y') || 
                      firstLine.includes('este') || firstLine.includes('norte') ||
                      firstLine.includes('easting') || firstLine.includes('northing');
    
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    for (const line of dataLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const parts = trimmed.split(/[,;\t]/).map(p => p.trim());
      
      if (parts.length < 2) {
        return {
          success: false,
          error: `Formato inválido en línea: "${line}". Se esperan al menos 2 columnas separadas por coma.`
        };
      }
      
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      
      if (isNaN(x) || isNaN(y)) {
        return {
          success: false,
          error: `Coordenadas inválidas en línea: "${line}"`
        };
      }
      
      vertices.push([x, y]);
    }
    
    if (vertices.length < 3) {
      return {
        success: false,
        error: 'Se requieren al menos 3 vértices para formar un polígono'
      };
    }
    
    return {
      success: true,
      vertices
    };
  } catch (error) {
    return {
      success: false,
      error: `Error al parsear CSV: ${error instanceof Error ? error.message : 'Error desconocido'}`
    };
  }
}

/**
 * Parser para archivos GeoJSON
 * Soporta Point, LineString, y Polygon
 */
export function parseGeoJSON(content: string): ImportResult {
  try {
    const geojson = JSON.parse(content);
    
    let coordinates: number[][] = [];
    
    // Detectar tipo de geometría
    if (geojson.type === 'Feature') {
      coordinates = extractCoordinatesFromGeometry(geojson.geometry);
    } else if (geojson.type === 'FeatureCollection') {
      if (!geojson.features || geojson.features.length === 0) {
        return {
          success: false,
          error: 'FeatureCollection vacía'
        };
      }
      // Tomar la primera feature
      coordinates = extractCoordinatesFromGeometry(geojson.features[0].geometry);
    } else if (['Point', 'LineString', 'Polygon', 'MultiPoint'].includes(geojson.type)) {
      coordinates = extractCoordinatesFromGeometry(geojson);
    } else {
      return {
        success: false,
        error: `Tipo de geometría no soportado: ${geojson.type}`
      };
    }
    
    if (coordinates.length < 3) {
      return {
        success: false,
        error: 'Se requieren al menos 3 coordenadas para formar un polígono'
      };
    }
    
    // Convertir a UTMCoordinate
    const vertices: UTMCoordinate[] = coordinates.map(coord => [coord[0], coord[1]]);
    
    return {
      success: true,
      vertices
    };
  } catch (error) {
    return {
      success: false,
      error: `Error al parsear GeoJSON: ${error instanceof Error ? error.message : 'Error desconocido'}`
    };
  }
}

/**
 * Extrae coordenadas de una geometría GeoJSON
 */
function extractCoordinatesFromGeometry(geometry: any): number[][] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates;
    
    case 'Polygon':
      // Tomar el anillo exterior (primer array)
      return geometry.coordinates[0];
    
    case 'MultiLineString':
      // Tomar la primera línea
      return geometry.coordinates[0];
    
    case 'MultiPolygon':
      // Tomar el primer polígono, anillo exterior
      return geometry.coordinates[0][0];
    
    default:
      return [];
  }
}

/**
 * Parser para archivos KML
 * Extrae coordenadas de Polygon o LineString
 */
export function parseKML(content: string): ImportResult {
  try {
    // Usar DOMParser para parsear XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    
    // Buscar errores de parseo
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      return {
        success: false,
        error: 'Error al parsear XML/KML'
      };
    }
    
    // Buscar coordenadas en Polygon o LineString
    let coordsElement = xmlDoc.querySelector('Polygon coordinates');
    if (!coordsElement) {
      coordsElement = xmlDoc.querySelector('LineString coordinates');
    }
    
    if (!coordsElement) {
      return {
        success: false,
        error: 'No se encontraron coordenadas en el archivo KML'
      };
    }
    
    const coordsText = coordsElement.textContent?.trim();
    if (!coordsText) {
      return {
        success: false,
        error: 'Coordenadas vacías en el archivo KML'
      };
    }
    
    // Parsear coordenadas: formato "lon,lat,alt lon,lat,alt ..."
    const vertices: UTMCoordinate[] = [];
    const coordPairs = coordsText.split(/\s+/);
    
    for (const pair of coordPairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      
      const parts = trimmed.split(',');
      if (parts.length < 2) continue;
      
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      
      if (isNaN(lon) || isNaN(lat)) {
        continue;
      }
      
      // KML usa lon,lat (no UTM), así que necesitaríamos convertir
      // Por ahora, asumir que ya son coordenadas proyectadas
      vertices.push([lon, lat]);
    }
    
    if (vertices.length < 3) {
      return {
        success: false,
        error: 'Se requieren al menos 3 vértices para formar un polígono'
      };
    }
    
    return {
      success: true,
      vertices
    };
  } catch (error) {
    return {
      success: false,
      error: `Error al parsear KML: ${error instanceof Error ? error.message : 'Error desconocido'}`
    };
  }
}

/**
 * Parser para texto simple (coordenadas pegadas)
 * Formato: cada línea tiene x y, separados por espacio, coma o tab
 */
export function parseTextCoordinates(content: string): ImportResult {
  try {
    const lines = content.trim().split('\n');
    const vertices: UTMCoordinate[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Separar por espacios, comas o tabs
      const parts = trimmed.split(/[\s,\t]+/).map(p => p.trim()).filter(p => p);
      
      if (parts.length < 2) continue;
      
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      
      if (isNaN(x) || isNaN(y)) continue;
      
      vertices.push([x, y]);
    }
    
    if (vertices.length < 3) {
      return {
        success: false,
        error: 'Se requieren al menos 3 vértices. Formato esperado: una coordenada por línea (x y)'
      };
    }
    
    return {
      success: true,
      vertices
    };
  } catch (error) {
    return {
      success: false,
      error: `Error al parsear coordenadas: ${error instanceof Error ? error.message : 'Error desconocido'}`
    };
  }
}

/**
 * Detecta el formato y parsea automáticamente
 */
export function parseFileContent(filename: string, content: string): ImportResult {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'csv':
      return parseCSV(content);
    
    case 'json':
    case 'geojson':
      return parseGeoJSON(content);
    
    case 'kml':
      return parseKML(content);
    
    case 'txt':
      return parseTextCoordinates(content);
    
    default:
      // Intentar detectar automáticamente
      const trimmed = content.trim();
      
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return parseGeoJSON(content);
      }
      
      if (trimmed.startsWith('<?xml') || trimmed.includes('<kml')) {
        return parseKML(content);
      }
      
      if (trimmed.includes(',')) {
        return parseCSV(content);
      }
      
      return parseTextCoordinates(content);
  }
}

/**
 * Valida coordenadas UTM para la zona 18S (Perú)
 */
export function validateUTMCoordinates(vertices: UTMCoordinate[]): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  for (const [x, y] of vertices) {
    // Zona 18S de Perú: aproximadamente
    // X (Easting): 160,000 - 840,000
    // Y (Northing): 8,000,000 - 9,000,000
    
    if (x < 100000 || x > 900000) {
      warnings.push(`Coordenada X sospechosa: ${x}. Verifica que sean coordenadas UTM Zone 18S.`);
    }
    
    if (y < 8000000 || y > 9500000) {
      warnings.push(`Coordenada Y sospechosa: ${y}. Verifica que sean coordenadas UTM Zone 18S.`);
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings
  };
}
