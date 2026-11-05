import { describe, it, expect } from 'vitest';
import { EJEMPLOS_IMPORTACION, ejemploPorExtension } from './importExamples';
import { parseFileContent } from './importers';

describe('ejemplos de importación', () => {
  it('hay un ejemplo por cada extensión que muestra el modal', () => {
    expect(EJEMPLOS_IMPORTACION.map((e) => e.ext).sort()).toEqual(
      ['.csv', '.geojson', '.json', '.kml', '.txt'].sort(),
    );
  });

  const LOTE = [
    [284500, 8670100],
    [284510, 8670100],
    [284510, 8670080],
    [284500, 8670080],
  ];

  // KML se omite: parseKML usa DOMParser (solo existe en el navegador). Se
  // verificó en el navegador; aquí se comprueba su estructura.
  for (const e of EJEMPLOS_IMPORTACION.filter((x) => x.ext !== '.kml')) {
    it(`el ejemplo ${e.ext} se importa como el lote de 4 vértices`, () => {
      const r = parseFileContent(e.archivo, e.contenido);
      expect(r.success, r.error).toBe(true);
      expect(r.vertices).toHaveLength(4);
      // CSV/TXT van en UTM (exactos); GeoJSON va en grados y se convierte
      // (diferencia < 1 cm por el redondeo a 8 decimales de los grados).
      r.vertices!.forEach((v, i) => {
        expect(Math.abs(v[0] - LOTE[i][0])).toBeLessThan(0.01);
        expect(Math.abs(v[1] - LOTE[i][1])).toBeLessThan(0.01);
      });
    });
  }

  it('el ejemplo GeoJSON avisa que convirtió de grados a UTM', () => {
    const r = parseFileContent('x.json', ejemploPorExtension('.json')!.contenido);
    expect(r.notas?.join(' ')).toContain('convertidas a UTM zona 18S');
  });

  it('el ejemplo KML es XML con un Polygon de 5 pares (anillo cerrado)', () => {
    const kml = ejemploPorExtension('.kml')!.contenido;
    expect(kml).toContain('<Polygon>');
    const coords = kml.match(/<coordinates>([\s\S]*?)<\/coordinates>/)![1].trim().split(/\s+/);
    expect(coords).toHaveLength(5);
    // En grados (lon,lat), no en UTM: lo normal en un KML de Google Earth.
    expect(parseFloat(coords[0].split(',')[0])).toBeLessThan(0);
  });

  it('.json y .geojson usan el mismo contenido', () => {
    expect(ejemploPorExtension('.json')!.contenido).toBe(
      ejemploPorExtension('.geojson')!.contenido,
    );
  });
});
