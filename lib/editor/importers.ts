import { UTMCoordinate } from '@/types/planos';
import { ImportResult } from '@/types/editor';
import proj4 from 'proj4';
import { getUtmProjString, DEFAULT_UTM_ZONE } from '@/lib/geometry/utmUtils';

/**
 * Parsers para importar coordenadas de CSV, TXT, GeoJSON y KML.
 *
 * Criterios (verificados con archivos reales de Excel, AutoCAD, QGIS y Google
 * Earth, no solo con los ejemplos de la documentación):
 *  - CSV y TXT comparten un lector tabular: detecta `;`, tabulación, coma o
 *    espacios; entiende la coma decimal (Excel en español); ignora columnas de
 *    texto (nombre/ID) y columnas extra; usa el encabezado si dice Este/Norte.
 *  - Nada se pierde en silencio: las líneas descartadas se cuentan y se avisan.
 *  - El vértice final que repite al primero (cierre del anillo) se quita en todos
 *    los formatos: el editor modela el polígono abierto.
 *  - GeoJSON y KML llevan lon/lat WGS84 por norma: se convierten a UTM 18S.
 *    CSV y TXT deben venir en UTM (no hay norma de orden de ejes).
 *  - Si un GeoJSON/KML trae varios polígonos, se devuelven todos para elegir.
 */

// ---------------------------------------------------------------------------
// Grados (lon/lat) -> UTM
// ---------------------------------------------------------------------------

const WGS84 = 'EPSG:4326';

/** ¿Todas las coordenadas caben en rangos de grados (|x|<=180, |y|<=90)? Un
 *  Este UTM válido nunca baja de ~100 000, así que no hay falsos positivos. */
function pareceLonLat(coords: number[][]): boolean {
  return coords.length > 0 && coords.every((c) => Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90);
}

const enPeru = (lon: number, lat: number) => lon >= -82 && lon <= -68 && lat >= -19 && lat <= 0;

type Conversion =
  | { ok: true; vertices: UTMCoordinate[] }
  | { ok: false; error: string };

const NOTA_CONVERSION = `Coordenadas en grados (lon/lat WGS84) convertidas a UTM zona ${DEFAULT_UTM_ZONE}S. Revisa que los metros se vean correctos.`;

function convertirLonLatAUTM(coords: number[][]): Conversion {
  const fuera = coords.find((c) => !enPeru(c[0], c[1]));
  if (fuera) {
    const invertido = enPeru(fuera[1], fuera[0]);
    return {
      ok: false,
      error: invertido
        ? `Las coordenadas parecen estar en orden (latitud, longitud). GeoJSON y KML usan (longitud, latitud): intercambia las columnas. Ejemplo del primer punto fuera de lugar: ${fuera[0]}, ${fuera[1]}.`
        : `Las coordenadas están en grados pero fuera del Perú (lon ${fuera[0]}, lat ${fuera[1]}). Revisa el archivo.`,
    };
  }
  // El editor trabaja solo en la zona UTM 18S. Un lote de otra zona (17 o 19)
  // forzado a la 18 queda lejos de su meridiano central y sale con errores de
  // decímetros por cada 20 m: en un plano catastral eso no se acepta.
  const lonMedia = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const zonaNatural = Math.floor((lonMedia + 180) / 6) + 1;
  if (zonaNatural !== DEFAULT_UTM_ZONE) {
    return {
      ok: false,
      error: `El lote está en la zona UTM ${zonaNatural}, pero el editor solo trabaja en la zona ${DEFAULT_UTM_ZONE}S (longitud entre -78° y -72°). Un plano en otra zona saldría distorsionado.`,
    };
  }
  const utm = getUtmProjString(DEFAULT_UTM_ZONE);
  const vertices = coords.map((c) => {
    const [x, y] = proj4(WGS84, utm, [c[0], c[1]]);
    return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] as UTMCoordinate;
  });
  return { ok: true, vertices };
}

const ERROR_GRADOS_EN_TABLA =
  'Estas coordenadas están en grados (lon/lat) y CSV/TXT debe venir en UTM (metros, zona 18S). Exporta en UTM, o usa GeoJSON o KML, que sí se convierten solos.';

/**
 * El spec de GeoJSON/KML exige anillos cerrados (primer y último punto
 * idénticos). El editor modela el polígono abierto: sin quitar el duplicado
 * quedaría un lado de longitud cero que puede producir NaN al generar el PDF.
 */
function dropClosingDuplicate<T extends number[]>(coords: T[]): T[] {
  if (coords.length < 2) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  const isClosed = Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6;
  return isClosed ? coords.slice(0, -1) : coords;
}

const NOTA_CIERRE =
  'Se quitó el último vértice porque repetía al primero (cierre del polígono).';

// ---------------------------------------------------------------------------
// CSV y TXT: lector tabular común
// ---------------------------------------------------------------------------

const ENTERO_DECIMAL = /^[+-]?\d+(\.\d+)?$/;
const COMA_DECIMAL = /^[+-]?\d+,\d+$/;

/** "284500.5" y "284500,5" -> número; cualquier otra cosa -> null. */
function aNumero(campo: string): number | null {
  let t = campo.trim().replace(/^["']|["']$/g, '');
  if (COMA_DECIMAL.test(t)) t = t.replace(',', '.');
  return ENTERO_DECIMAL.test(t) ? Number(t) : null;
}

type Separador = ';' | '\t' | ',' | 'espacios';

function detectarSeparador(lineas: string[]): Separador {
  const muestra = lineas.slice(0, 50);
  if (muestra.some((l) => l.includes(';'))) return ';';
  if (muestra.some((l) => l.includes('\t'))) return '\t';
  // Coma decimal separada por espacios: "284500,50 8670100,25"
  const conComaDecimal = muestra.filter(
    (l) => l.split(/\s+/).filter((t) => COMA_DECIMAL.test(t)).length >= 2,
  );
  if (conComaDecimal.length > 0 && conComaDecimal.length >= muestra.length / 2) return 'espacios';
  if (muestra.some((l) => l.includes(','))) return ',';
  return 'espacios';
}

const dividir = (linea: string, sep: Separador): string[] =>
  sep === 'espacios' ? linea.split(/\s+/).filter(Boolean) : linea.split(sep).map((c) => c.trim());

const normalizarNombre = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

function parseTabular(content: string, formato: 'CSV' | 'TXT'): ImportResult {
  try {
    const lineas = content
      .replace(/^﻿/, '')
      .split(/\r\n|\n|\r/)
      .map((texto, i) => ({ n: i + 1, texto: texto.trim() }))
      .filter((l) => l.texto !== '' && !l.texto.startsWith('#'));

    if (lineas.length === 0) {
      return { success: false, error: `El archivo ${formato} está vacío.` };
    }

    const sep = detectarSeparador(lineas.map((l) => l.texto));
    const filas = lineas.map((l) => ({ ...l, campos: dividir(l.texto, sep) }));
    const numeros = (campos: string[]) => campos.map(aNumero);

    // Encabezado: primera fila SIN ningún campo numérico. (Una fila "V1,284500,
    // 8670100" tiene números: es un dato con columna de nombre, no un encabezado.)
    let colX = -1;
    let colY = -1;
    let datos = filas;
    if (numeros(filas[0].campos).every((n) => n === null)) {
      datos = filas.slice(1);
      const nombres = filas[0].campos.map(normalizarNombre);
      colX = nombres.findIndex((n) => ['x', 'este', 'easting', 'e'].includes(n));
      colY = nombres.findIndex((n) => ['y', 'norte', 'northing', 'n'].includes(n));
      if (colX < 0 || colY < 0) {
        colX = -1;
        colY = -1;
      }
    }

    const matriz = datos.map((f) => numeros(f.campos));
    const nCols = Math.max(0, ...matriz.map((r) => r.length));

    // Sin encabezado útil: buscar por valores. Una columna Este UTM está en
    // [100 000, 1 000 000) y la Norte siguiente en [1 000 000, 11 000 000]. Esto
    // salta columnas de nombre/ID y las extra (cota, descripción).
    if (colX < 0) {
      const columna = (c: number) =>
        matriz.map((r) => r[c]).filter((n): n is number => n !== null && n !== undefined);
      const mitad = Math.ceil(matriz.length / 2);
      for (let c = 0; c < nCols - 1 && colX < 0; c++) {
        const a = columna(c);
        const b = columna(c + 1);
        if (
          a.length >= mitad &&
          b.length >= mitad &&
          a.every((n) => n >= 100000 && n < 1000000) &&
          b.every((n) => n >= 1000000 && n <= 11000000)
        ) {
          colX = c;
          colY = c + 1;
        }
      }
      if (colX < 0) {
        // Respaldo (grados u otras unidades): las dos primeras columnas numéricas.
        const numericas = Array.from({ length: nCols }, (_, c) => c).filter(
          (c) => columna(c).length >= mitad,
        );
        if (numericas.length < 2) {
          return {
            success: false,
            error: `No encontré dos columnas numéricas (X e Y) en el ${formato}. Cada línea debe traer al menos dos números (Este y Norte).`,
          };
        }
        colX = numericas[0];
        colY = numericas[1];
      }
    }

    const vertices: UTMCoordinate[] = [];
    const descartadas: { n: number; texto: string }[] = [];
    datos.forEach((f, i) => {
      const x = matriz[i][colX];
      const y = matriz[i][colY];
      if (x === null || x === undefined || y === null || y === undefined) {
        descartadas.push({ n: f.n, texto: f.texto });
      } else {
        vertices.push([x, y]);
      }
    });

    if (vertices.length < 3) {
      return {
        success: false,
        error: `Se requieren al menos 3 vértices y solo pude leer ${vertices.length}. Formato esperado: una línea por vértice con X (Este) e Y (Norte).`,
      };
    }
    if (pareceLonLat(vertices)) {
      return { success: false, error: ERROR_GRADOS_EN_TABLA };
    }

    const notas: string[] = [];
    const advertencias: string[] = [];

    if (descartadas.length > 0) {
      const ej = descartadas
        .slice(0, 3)
        .map((d) => `línea ${d.n}: "${d.texto.slice(0, 40)}"`)
        .join('; ');
      advertencias.push(
        `Se ignoraron ${descartadas.length} de ${datos.length} líneas que no tienen X e Y numéricos (${ej}${descartadas.length > 3 ? '; ...' : ''}). Revisa que no falte ningún vértice.`,
      );
    }
    if (sep !== ',' && lineas.some((l) => /\d,\d/.test(l.texto))) {
      notas.push('Se interpretó la coma como separador decimal.');
    }

    const sinCierre = dropClosingDuplicate(vertices);
    if (sinCierre.length !== vertices.length) notas.push(NOTA_CIERRE);

    return {
      success: true,
      vertices: sinCierre,
      ...(notas.length ? { notas } : {}),
      ...(advertencias.length ? { advertencias } : {}),
    };
  } catch (error) {
    return {
      success: false,
      error: `Error al leer el ${formato}: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    };
  }
}

/** CSV: columnas X,Y (o Este,Norte); separador `,`, `;` o tabulación; coma decimal. */
export function parseCSV(content: string): ImportResult {
  return parseTabular(content, 'CSV');
}

/** TXT: un vértice por línea; separador espacio, tabulación, `;` o coma. */
export function parseTextCoordinates(content: string): ImportResult {
  return parseTabular(content, 'TXT');
}

// ---------------------------------------------------------------------------
// GeoJSON y KML: varios polígonos, conversión a UTM
// ---------------------------------------------------------------------------

interface Candidato {
  nombre: string;
  coords: number[][];
}

/** Convierte y deduplica los candidatos y arma el resultado (uno o varios). */
function finalizarCandidatos(candidatos: Candidato[], formato: string): ImportResult {
  const validos = candidatos
    .map((c) => ({ ...c, coords: dropClosingDuplicate(c.coords) }))
    .filter((c) => c.coords.length >= 3);

  if (validos.length === 0) {
    return {
      success: false,
      error: `No se encontró un polígono válido en el ${formato}: se requieren al menos 3 coordenadas (¿el elemento no tiene geometría?).`,
    };
  }

  const notas: string[] = [];
  const final: { nombre: string; vertices: UTMCoordinate[] }[] = [];
  let convertido = false;
  for (const c of validos) {
    if (pareceLonLat(c.coords)) {
      const conv = convertirLonLatAUTM(c.coords);
      if (!conv.ok) return { success: false, error: conv.error };
      final.push({ nombre: c.nombre, vertices: conv.vertices });
      convertido = true;
    } else {
      final.push({ nombre: c.nombre, vertices: c.coords.map((p) => [p[0], p[1]] as UTMCoordinate) });
    }
  }
  if (convertido) notas.push(NOTA_CONVERSION);

  return {
    success: true,
    vertices: final[0].vertices,
    ...(final.length > 1 ? { candidatos: final } : {}),
    ...(notas.length ? { notas } : {}),
  };
}

const nombreDe = (props: any, i: number): string => {
  const n = props && (props.name ?? props.nombre ?? props.Name ?? props.id ?? props.codigo ?? props.lote);
  return n !== undefined && n !== null && String(n).trim() ? String(n).trim() : `Polígono ${i + 1}`;
};

/** Recorre una geometría GeoJSON y devuelve los contornos que contiene. */
function contornosDeGeometria(geom: any, nombre: string, salida: Candidato[]): void {
  if (!geom || !geom.type) return;
  switch (geom.type) {
    case 'Polygon':
      if (geom.coordinates?.[0]) salida.push({ nombre, coords: geom.coordinates[0] });
      break;
    case 'MultiPolygon':
      (geom.coordinates || []).forEach((poly: number[][][], i: number) => {
        if (poly?.[0]) salida.push({ nombre: `${nombre} (parte ${i + 1})`, coords: poly[0] });
      });
      break;
    case 'LineString':
    case 'MultiPoint':
      salida.push({ nombre, coords: geom.coordinates || [] });
      break;
    case 'MultiLineString':
      (geom.coordinates || []).forEach((l: number[][], i: number) =>
        salida.push({ nombre: `${nombre} (línea ${i + 1})`, coords: l }),
      );
      break;
    case 'GeometryCollection':
      (geom.geometries || []).forEach((g: any) => contornosDeGeometria(g, nombre, salida));
      break;
    default:
      break; // Point suelto: no forma un polígono
  }
}

/** Parser para archivos GeoJSON (Feature, FeatureCollection o geometría suelta). */
export function parseGeoJSON(content: string): ImportResult {
  try {
    const gj = JSON.parse(content);
    const candidatos: Candidato[] = [];

    if (gj.type === 'FeatureCollection') {
      const features: any[] = gj.features || [];
      if (features.length === 0) return { success: false, error: 'FeatureCollection vacía' };
      // Exportes topográficos típicos: un Feature Point por vértice. Se leen
      // juntos, en orden, como UN contorno.
      if (features.every((f) => f?.geometry?.type === 'Point')) {
        candidatos.push({
          nombre: 'Puntos del archivo',
          coords: features.map((f) => f.geometry.coordinates),
        });
      } else {
        features.forEach((f, i) => contornosDeGeometria(f?.geometry, nombreDe(f?.properties, i), candidatos));
      }
    } else if (gj.type === 'Feature') {
      contornosDeGeometria(gj.geometry, nombreDe(gj.properties, 0), candidatos);
    } else if (
      ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString', 'MultiPoint', 'GeometryCollection'].includes(gj.type)
    ) {
      contornosDeGeometria(gj, 'Polígono 1', candidatos);
    } else {
      return { success: false, error: `Tipo de GeoJSON no soportado: ${gj.type}` };
    }

    return finalizarCandidatos(candidatos, 'GeoJSON');
  } catch (error) {
    return {
      success: false,
      error: `Error al leer el GeoJSON: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    };
  }
}

/** "lon,lat,alt lon,lat,alt ..." -> [[lon,lat],...] */
function coordenadasKml(texto: string): number[][] {
  const out: number[][] = [];
  for (const par of texto.trim().split(/\s+/)) {
    const partes = par.split(',');
    if (partes.length < 2) continue;
    const a = parseFloat(partes[0]);
    const b = parseFloat(partes[1]);
    if (!isNaN(a) && !isNaN(b)) out.push([a, b]);
  }
  return out;
}

/** Parser para archivos KML (Polygon, LineString o Placemarks Point). */
export function parseKML(content: string): ImportResult {
  try {
    const xml = new DOMParser().parseFromString(content, 'text/xml');
    if (xml.querySelector('parsererror')) {
      return { success: false, error: 'El archivo no es un XML/KML válido.' };
    }

    const nombreKml = (el: Element, i: number) => {
      const placemark = el.closest('Placemark');
      const n = placemark?.querySelector('name')?.textContent?.trim();
      return n || `Polígono ${i + 1}`;
    };

    const candidatos: Candidato[] = [];
    xml.querySelectorAll('Polygon').forEach((poly, i) => {
      const c = poly.querySelector('outerBoundaryIs coordinates') ?? poly.querySelector('coordinates');
      if (c?.textContent) candidatos.push({ nombre: nombreKml(poly, i), coords: coordenadasKml(c.textContent) });
    });
    if (candidatos.length === 0) {
      xml.querySelectorAll('LineString').forEach((ls, i) => {
        const c = ls.querySelector('coordinates');
        if (c?.textContent) candidatos.push({ nombre: nombreKml(ls, i), coords: coordenadasKml(c.textContent) });
      });
    }
    if (candidatos.length === 0) {
      // Levantamientos: un Placemark Point por vértice -> un solo contorno.
      const puntos: number[][] = [];
      xml.querySelectorAll('Point coordinates').forEach((c) => {
        if (c.textContent) puntos.push(...coordenadasKml(c.textContent).slice(0, 1));
      });
      if (puntos.length > 0) candidatos.push({ nombre: 'Puntos del archivo', coords: puntos });
    }
    if (candidatos.length === 0) {
      return { success: false, error: 'No se encontraron polígonos, líneas ni puntos con coordenadas en el KML.' };
    }

    return finalizarCandidatos(candidatos, 'KML');
  } catch (error) {
    return {
      success: false,
      error: `Error al leer el KML: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Detección de formato y validación
// ---------------------------------------------------------------------------

/** Detecta el formato por la extensión (o por el contenido) y lo parsea. */
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
    default: {
      const trimmed = content.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseGeoJSON(content);
      if (trimmed.startsWith('<?xml') || trimmed.includes('<kml')) return parseKML(content);
      if (trimmed.includes(',') || trimmed.includes(';')) return parseCSV(content);
      return parseTextCoordinates(content);
    }
  }
}

/**
 * Valida coordenadas UTM para la zona 18S (Perú). Los mensajes se deduplican:
 * un archivo con 40 vértices malos daba 40 avisos idénticos.
 */
export function validateUTMCoordinates(vertices: UTMCoordinate[]): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let malosX = 0;
  let malosY = 0;
  let ejX: number | undefined;
  let ejY: number | undefined;

  for (const [x, y] of vertices) {
    // Zona 18S de Perú: aproximadamente
    // X (Easting): 160,000 - 840,000
    // Y (Northing): 8,000,000 - 9,000,000
    if (x < 100000 || x > 900000) {
      malosX++;
      ejX ??= x;
    }
    if (y < 8000000 || y > 9500000) {
      malosY++;
      ejY ??= y;
    }
  }

  // Un aviso por eje (no uno por vértice), con un ejemplo y cuántos son.
  if (malosX > 0)
    warnings.push(`Coordenada X sospechosa en ${malosX} de ${vertices.length} vértices (ej.: ${ejX}). Verifica que sean coordenadas UTM zona 18S.`);
  if (malosY > 0)
    warnings.push(`Coordenada Y sospechosa en ${malosY} de ${vertices.length} vértices (ej.: ${ejY}). Verifica que sean coordenadas UTM zona 18S.`);

  return { valid: warnings.length === 0, warnings };
}
