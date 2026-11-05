/**
 * Ejemplos de archivos de importación, uno por formato que acepta el modal
 * "Importar datos" (lib/editor/importers.ts). Cada ejemplo es un lote
 * rectangular de 10 m x 20 m en UTM WGS84 zona 18S (metros).
 *
 * CSV y TXT van en UTM; GeoJSON y KML van en lon/lat (lo estándar) y se convierten
 * a UTM 18S al importarlos. Los usa el modal (copiar / descargar) y una prueba que
 * comprueba que TODOS se leen con los mismos parsers que los archivos reales: si un parser cambia y un
 * ejemplo deja de importar, la prueba falla.
 */

export interface EjemploImportacion {
  /** Extensión con punto, tal como aparece en el modal. */
  ext: '.csv' | '.json' | '.geojson' | '.kml' | '.txt';
  formato: string;
  icono: string;
  /** Nombre con el que se descarga el ejemplo. */
  archivo: string;
  mime: string;
  descripcion: string;
  contenido: string;
}

// Escrito a mano (no con JSON.stringify) para que cada vértice quede en una línea.
const geojson = `{
  "type": "Feature",
  "properties": { "nombre": "Lote de ejemplo" },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [-76.97943110, -12.02324788],
        [-76.97933928, -12.02324853],
        [-76.97934060, -12.02342929],
        [-76.97943242, -12.02342864],
        [-76.97943110, -12.02324788]
      ]
    ]
  }
}`;

export const EJEMPLOS_IMPORTACION: EjemploImportacion[] = [
  {
    ext: '.csv',
    formato: 'CSV',
    icono: '📄',
    archivo: 'ejemplo_lote.csv',
    mime: 'text/csv',
    descripcion: 'Columnas X (Este) e Y (Norte) en UTM. Acepta encabezado, ";" y coma decimal (Excel en español) y una columna de nombre.',
    contenido:
      'x,y\n284500.00,8670100.00\n284510.00,8670100.00\n284510.00,8670080.00\n284500.00,8670080.00\n',
  },
  {
    ext: '.json',
    formato: 'GeoJSON',
    icono: '🗺️',
    archivo: 'ejemplo_lote.json',
    mime: 'application/json',
    descripcion: 'Feature con un Polygon en grados [lon, lat] (lo estándar); se convierte solo a UTM 18S. También se acepta [X, Y] ya en UTM.',
    contenido: geojson + '\n',
  },
  {
    ext: '.geojson',
    formato: 'GeoJSON',
    icono: '🗺️',
    archivo: 'ejemplo_lote.geojson',
    mime: 'application/geo+json',
    descripcion: 'Igual que .json; solo cambia la extensión. Grados lon/lat, se convierte a UTM 18S.',
    contenido: geojson + '\n',
  },
  {
    ext: '.kml',
    formato: 'KML',
    icono: '📍',
    archivo: 'ejemplo_lote.kml',
    mime: 'application/vnd.google-earth.kml+xml',
    descripcion:
      'Polygon con <coordinates> "lon,lat,alt" separadas por espacios (lo estándar de Google Earth); se convierte solo a UTM 18S.',
    contenido: `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>Lote de ejemplo</name>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>
            -76.97943110,-12.02324788,0 -76.97933928,-12.02324853,0 -76.97934060,-12.02342929,0 -76.97943242,-12.02342864,0 -76.97943110,-12.02324788,0
          </coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>
</kml>
`,
  },
  {
    ext: '.txt',
    formato: 'Texto',
    icono: '📝',
    archivo: 'ejemplo_lote.txt',
    mime: 'text/plain',
    descripcion: 'Un vértice por línea en UTM: X e Y separados por espacio (puede llevar una etiqueta al inicio).',
    contenido:
      '284500.00 8670100.00\n284510.00 8670100.00\n284510.00 8670080.00\n284500.00 8670080.00\n',
  },
];

export function ejemploPorExtension(ext: string): EjemploImportacion | undefined {
  return EJEMPLOS_IMPORTACION.find((e) => e.ext === ext);
}
