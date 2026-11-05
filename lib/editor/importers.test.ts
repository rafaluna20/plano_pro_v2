import { describe, it, expect } from 'vitest';
import { parseFileContent, parseGeoJSON, parseCSV, parseTextCoordinates, validateUTMCoordinates } from './importers';

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const poligono = (coords: number[][]) =>
  JSON.stringify({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } });

// Lote pequeño en Pucusana (~11 m de lado), en grados [lon, lat].
const PUCUSANA = [
  [-76.7990, -12.4700],
  [-76.7989, -12.4700],
  [-76.7989, -12.4701],
  [-76.7990, -12.4701],
  [-76.7990, -12.4700],
];

describe('GeoJSON en grados (lon/lat) -> UTM 18S', () => {
  it('convierte a metros UTM del Perú y quita el vértice de cierre', () => {
    const r = parseGeoJSON(poligono(PUCUSANA));
    expect(r.success, r.error).toBe(true);
    expect(r.vertices).toHaveLength(4);
    for (const [x, y] of r.vertices!) {
      expect(x).toBeGreaterThan(100000);
      expect(x).toBeLessThan(900000);
      expect(y).toBeGreaterThan(8000000);
      expect(y).toBeLessThan(9500000);
    }
    // 0.0001° de longitud a -12.47° ≈ 10.9 m: la escala debe ser de metros.
    expect(dist(r.vertices![0], r.vertices![1])).toBeGreaterThan(10);
    expect(dist(r.vertices![0], r.vertices![1])).toBeLessThan(12);
    expect(r.notas?.join(' ')).toContain('UTM zona 18S');
  });

  it('rechaza grados fuera del Perú', () => {
    const r = parseGeoJSON(poligono([[2.35, 48.85], [2.36, 48.85], [2.36, 48.86], [2.35, 48.85]]));
    expect(r.success).toBe(false);
    expect(r.error).toContain('fuera del Perú');
  });

  it('rechaza un lote de otra zona UTM (Puno, zona 19) en vez de distorsionarlo', () => {
    const puno = [[-70.0200, -15.8400], [-70.0199, -15.8400], [-70.0199, -15.8401], [-70.0200, -15.8400]];
    const r = parseGeoJSON(poligono(puno));
    expect(r.success).toBe(false);
    expect(r.error).toContain('zona UTM 19');
    expect(r.error).toContain('zona 18S');
  });

  it('detecta latitud y longitud invertidas', () => {
    const invertido = PUCUSANA.map(([lon, lat]) => [lat, lon]);
    const r = parseGeoJSON(poligono(invertido));
    expect(r.success).toBe(false);
    expect(r.error).toContain('latitud, longitud');
  });

  it('un GeoJSON que ya viene en UTM pasa sin convertir ni avisar', () => {
    const r = parseGeoJSON(
      poligono([[284500, 8670100], [284510, 8670100], [284510, 8670080], [284500, 8670100]]),
    );
    expect(r.success).toBe(true);
    expect(r.vertices![0]).toEqual([284500, 8670100]);
    expect(r.notas).toBeUndefined();
  });

  it('un Feature con geometry null da un mensaje claro, no un error técnico', () => {
    const r = parseGeoJSON(JSON.stringify({ type: 'Feature', geometry: null }));
    expect(r.success).toBe(false);
    expect(r.error).not.toContain('Cannot read properties');
    expect(r.error).toContain('polígono válido');
  });
});

describe('CSV y TXT con grados', () => {
  it('CSV en grados se rechaza con una explicación', () => {
    const r = parseCSV('x,y\n-76.7990,-12.4700\n-76.7989,-12.4700\n-76.7989,-12.4701');
    expect(r.success).toBe(false);
    expect(r.error).toContain('grados');
  });

  it('TXT en grados se rechaza con una explicación', () => {
    const r = parseTextCoordinates('-76.7990 -12.4700\n-76.7989 -12.4700\n-76.7989 -12.4701');
    expect(r.success).toBe(false);
    expect(r.error).toContain('grados');
  });

  it('CSV en UTM sigue funcionando', () => {
    const r = parseFileContent('a.csv', 'x,y\n284500,8670100\n284510,8670100\n284510,8670080');
    expect(r.success, r.error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Casos reales que antes importaban mal o en silencio (propuestas 3 y 4)
// ---------------------------------------------------------------------------
const LOTE = [
  [284500, 8670100],
  [284510, 8670100],
  [284510, 8670080],
  [284500, 8670080],
];

describe('CSV/TXT como los produce Excel en español y AutoCAD', () => {
  it('CSV con ; y coma decimal -> 284500.5, no Y=50', () => {
    const r = parseCSV('X;Y\n284500,50;8670100,25\n284510,50;8670100,25\n284510,50;8670080,25\n284500,50;8670080,25');
    expect(r.success, r.error).toBe(true);
    expect(r.vertices![0]).toEqual([284500.5, 8670100.25]);
    expect(r.vertices).toHaveLength(4);
    expect(r.notas?.join(' ')).toContain('coma como separador decimal');
  });

  it('TXT con coma decimal separada por espacios', () => {
    const r = parseTextCoordinates('284500,50 8670100,25\n284510,50 8670100,25\n284510,50 8670080,25\n284500,50 8670080,25');
    expect(r.success, r.error).toBe(true);
    expect(r.vertices![1]).toEqual([284510.5, 8670100.25]);
  });

  it('CSV con columna de nombre (Punto,Este,Norte) usa Este y Norte', () => {
    const r = parseCSV('Punto,Este,Norte\nV1,284500,8670100\nV2,284510,8670100\nV3,284510,8670080\nV4,284500,8670080');
    expect(r.success, r.error).toBe(true);
    expect(r.vertices).toEqual(LOTE);
  });

  it('CSV con ID numérico y cota extra: toma las columnas que parecen UTM', () => {
    const r = parseCSV('1,284500,8670100,120.5\n2,284510,8670100,120.7\n3,284510,8670080,120.9\n4,284500,8670080,121.0');
    expect(r.success, r.error).toBe(true);
    expect(r.vertices).toEqual(LOTE);
  });

  it('encabezado con Norte antes que Este se respeta', () => {
    const r = parseCSV('Norte;Este\n8670100;284500\n8670100;284510\n8670080;284510\n8670080;284500');
    expect(r.success, r.error).toBe(true);
    expect(r.vertices![0]).toEqual([284500, 8670100]);
  });

  it('TXT con etiquetas (A 284500 8670100) ahora se lee', () => {
    const r = parseTextCoordinates('A 284500 8670100\nB 284510 8670100\nC 284510 8670080\nD 284500 8670080');
    expect(r.success, r.error).toBe(true);
    expect(r.vertices).toEqual(LOTE);
  });

  it('separado por tabulaciones y con saltos CRLF y BOM', () => {
    const r = parseCSV('\uFEFFx\ty\r\n284500\t8670100\r\n284510\t8670100\r\n284510\t8670080\r\n');
    expect(r.success, r.error).toBe(true);
    expect(r.vertices).toHaveLength(3);
  });
});

describe('no perder datos en silencio', () => {
  it('quita el vértice final repetido en CSV y TXT y lo avisa', () => {
    const csv = parseCSV('x,y\n284500,8670100\n284510,8670100\n284510,8670080\n284500,8670080\n284500,8670100');
    expect(csv.vertices).toHaveLength(4);
    expect(csv.notas?.join(' ')).toContain('repetía al primero');
    const txt = parseTextCoordinates('284500 8670100\n284510 8670100\n284510 8670080\n284500 8670100');
    expect(txt.vertices).toHaveLength(3);
  });

  it('una línea dañada se descarta CON advertencia (antes en silencio)', () => {
    const r = parseTextCoordinates('284500 8670100\n284510 8670100\n284510 abc\n284510 8670080\n284500 8670080');
    expect(r.success).toBe(true);
    expect(r.vertices).toHaveLength(4);
    expect(r.advertencias?.join(' ')).toContain('Se ignoraron 1 de 5');
    expect(r.advertencias?.join(' ')).toContain('línea 3');
  });

  it('sin líneas dañadas no hay advertencias', () => {
    const r = parseCSV('x,y\n284500,8670100\n284510,8670100\n284510,8670080');
    expect(r.advertencias).toBeUndefined();
  });

  it('menos de 3 vértices dice cuántos leyó', () => {
    const r = parseTextCoordinates('284500 8670100\n284510 8670100');
    expect(r.success).toBe(false);
    expect(r.error).toContain('solo pude leer 2');
  });

  it('un archivo vacío o sin dos columnas numéricas da un error claro', () => {
    expect(parseCSV('').error).toContain('vacío');
    expect(parseCSV('nombre\nabc\ndef\nghi').error).toContain('dos columnas numéricas');
  });
});

describe('GeoJSON con varios polígonos', () => {
  const rect = (x0: number) => [[x0, 8670100], [x0 + 10, 8670100], [x0 + 10, 8670080], [x0, 8670080], [x0, 8670100]];

  it('FeatureCollection con 2 polígonos devuelve los dos, con nombre', () => {
    const r = parseGeoJSON(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { name: 'Lote A' }, geometry: { type: 'Polygon', coordinates: [rect(284500)] } },
          { type: 'Feature', properties: { nombre: 'Lote B' }, geometry: { type: 'Polygon', coordinates: [rect(284520)] } },
        ],
      }),
    );
    expect(r.success, r.error).toBe(true);
    expect(r.candidatos).toHaveLength(2);
    expect(r.candidatos!.map((c) => c.nombre)).toEqual(['Lote A', 'Lote B']);
    expect(r.vertices).toEqual(r.candidatos![0].vertices);
  });

  it('MultiPolygon se separa en sus partes', () => {
    const r = parseGeoJSON(
      JSON.stringify({ type: 'Feature', properties: { name: 'Manzana' }, geometry: { type: 'MultiPolygon', coordinates: [[rect(284500)], [rect(284520)]] } }),
    );
    expect(r.candidatos).toHaveLength(2);
    expect(r.candidatos![1].nombre).toContain('parte 2');
  });

  it('un solo polígono no trae lista de candidatos', () => {
    const r = parseGeoJSON(JSON.stringify({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [rect(284500)] } }));
    expect(r.candidatos).toBeUndefined();
    expect(r.advertencias).toBeUndefined();
  });

  it('FeatureCollection de puntos (un vértice por Feature) se lee como un contorno', () => {
    const r = parseGeoJSON(
      JSON.stringify({
        type: 'FeatureCollection',
        features: LOTE.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })),
      }),
    );
    expect(r.success, r.error).toBe(true);
    expect(r.vertices).toEqual(LOTE);
  });

  it('GeometryCollection con un polígono dentro ya no se rechaza', () => {
    const r = parseGeoJSON(JSON.stringify({ type: 'GeometryCollection', geometries: [{ type: 'Polygon', coordinates: [rect(284500)] }] }));
    expect(r.success, r.error).toBe(true);
  });
});

describe('validateUTMCoordinates', () => {
  it('no repite el mismo aviso por cada vértice malo', () => {
    const v = validateUTMCoordinates([[1, 2], [3, 4], [5, 6], [7, 8]]);
    expect(v.warnings.length).toBe(2); // uno de X y uno de Y
  });
});

describe('el nombre es el del archivo; nunca se inventa "Polígono N"', () => {
  const rect = (x0: number) => [[x0, 8670100], [x0 + 10, 8670100], [x0 + 10, 8670080], [x0, 8670080], [x0, 8670100]];
  const fc = (props: any[]) =>
    JSON.stringify({ type: 'FeatureCollection', features: props.map((p, i) => ({ type: 'Feature', ...(p === undefined ? {} : { properties: p }), geometry: { type: 'Polygon', coordinates: [rect(284500 + i * 20)] } })) });

  it('tu caso: "nombre": "" en cada polígono -> los tres quedan con nombre vacío', () => {
    const r = parseGeoJSON(fc([{ nombre: '' }, { nombre: '' }, { nombre: '' }]));
    expect(r.success, r.error).toBe(true);
    expect(r.candidatos!.map((c) => c.nombre)).toEqual(['', '', '']);
  });

  it('sin propiedades o sin campo de nombre: vacío, no "Polígono N"', () => {
    const r = parseGeoJSON(fc([undefined, {}, { otro: 'x' }]));
    expect(r.candidatos!.map((c) => c.nombre)).toEqual(['', '', '']);
  });

  it('un nombre real se respeta tal cual (recortando espacios)', () => {
    const r = parseGeoJSON(fc([{ nombre: '  Lote 5 ' }, { name: 'Calle 2' }]));
    expect(r.candidatos!.map((c) => c.nombre)).toEqual(['Lote 5', 'Calle 2']);
  });

  it('si no hay campo de nombre pero hay id/código, se usa ese identificador', () => {
    const r = parseGeoJSON(fc([{ id: 'A12' }, { codigo: 'B7' }]));
    expect(r.candidatos!.map((c) => c.nombre)).toEqual(['A12', 'B7']);
  });

  it('si el campo de nombre existe y está vacío, manda el vacío aunque haya un id', () => {
    const r = parseGeoJSON(fc([{ nombre: '', id: 'A12' }, { nombre: 'X' }]));
    expect(r.candidatos![0].nombre).toBe('');
  });

  it('un MultiPolygon sin nombre no inventa nombres de partes', () => {
    const r = parseGeoJSON(
      JSON.stringify({ type: 'Feature', properties: { nombre: '' }, geometry: { type: 'MultiPolygon', coordinates: [[rect(284500)], [rect(284520)]] } }),
    );
    expect(r.candidatos!.map((c) => c.nombre)).toEqual(['', '']);
  });

  it('un MultiPolygon con nombre sí numera sus partes', () => {
    const r = parseGeoJSON(
      JSON.stringify({ type: 'Feature', properties: { nombre: 'Manzana A' }, geometry: { type: 'MultiPolygon', coordinates: [[rect(284500)], [rect(284520)]] } }),
    );
    expect(r.candidatos!.map((c) => c.nombre)).toEqual(['Manzana A (parte 1)', 'Manzana A (parte 2)']);
  });

  it('un polígono único expone su nombre (vacío o no) para el importador', () => {
    expect(parseGeoJSON(JSON.stringify({ type: 'Feature', properties: { nombre: '' }, geometry: { type: 'Polygon', coordinates: [rect(284500)] } })).nombre).toBe('');
    expect(parseGeoJSON(JSON.stringify({ type: 'Feature', properties: { nombre: 'Lote X' }, geometry: { type: 'Polygon', coordinates: [rect(284500)] } })).nombre).toBe('Lote X');
  });

  it('una geometría suelta (sin Feature) no tiene nombre', () => {
    expect(parseGeoJSON(JSON.stringify({ type: 'Polygon', coordinates: [rect(284500)] })).nombre).toBe('');
  });
});
