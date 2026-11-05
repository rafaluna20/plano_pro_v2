import { describe, it, expect } from 'vitest';
import { PlanoRequestAdapter } from '@/lib/generators/PlanoRequestAdapter';
import { procesarDatosPlano } from './PlanoDataProcessor';
import { areaPlanaM2, perimetroPlanoM, parecenGrados } from '@/lib/geometry/planarMetrics';

// Lote de 10 x 20 m en UTM (metros), el mismo de las pruebas del editor.
const LOTE: [number, number][] = [
  [284500, 8670100],
  [284510, 8670100],
  [284510, 8670080],
  [284500, 8670080],
];

const peticion = (dim: { area: number; perimetro: number }): any => ({
  vertices: LOTE,
  dimensiones: { frente: 20, fondo: 20, ladoDerecho: 10, ladoIzquierdo: 10, ...dim },
  lote: {
    codigo: 'MZ-T-Lote05', nombre: 'Lote 5', manzana: 'T', etapa: '', numeroLote: '05', estado: 'libre',
    ubicacion: { departamento: 'Lima', provincia: 'Lima', distrito: 'Pucusana' },
  },
  colindancias: [],
});

describe('geometría plana (metros)', () => {
  it('área y perímetro de un rectángulo 10 x 20', () => {
    const anillo = [...LOTE, LOTE[0]]; // cerrado, como GeoJSON
    expect(areaPlanaM2(anillo)).toBe(200);
    expect(perimetroPlanoM(anillo)).toBe(60);
  });
  it('da lo mismo con el anillo abierto o cerrado', () => {
    expect(areaPlanaM2(LOTE)).toBe(areaPlanaM2([...LOTE, LOTE[0]]));
    expect(perimetroPlanoM(LOTE)).toBe(perimetroPlanoM([...LOTE, LOTE[0]]));
  });
  it('distingue grados de UTM', () => {
    expect(parecenGrados([[-76.8, -12.47], [-76.79, -12.47]])).toBe(true);
    expect(parecenGrados(LOTE)).toBe(false);
  });
});

describe('PlanoDataProcessor: área y perímetro calculados', () => {
  it('calcula en metros reales, no en "grados" (antes: 2 024 175 854 887 m²)', async () => {
    const d = await procesarDatosPlano(PlanoRequestAdapter.toHybridPayload(peticion({ area: 200, perimetro: 60 })));
    expect(d.datosCalculados!.areaGeometrica).toBeCloseTo(200, 6);
    expect(d.datosCalculados!.perimetroGeometrico).toBeCloseTo(60, 6);
  });

  it('con datos oficiales coherentes ya NO marca "requiere revisión" (antes siempre sí)', async () => {
    const d = await procesarDatosPlano(PlanoRequestAdapter.toHybridPayload(peticion({ area: 200, perimetro: 60 })));
    expect(d.flags.requiresReview).toBe(false);
    expect(d.flags.warnings.join(' ')).not.toContain('Discrepancia');
  });

  it('SÍ marca revisión si el dato oficial difiere de verdad de la geometría (>2 %)', async () => {
    const d = await procesarDatosPlano(PlanoRequestAdapter.toHybridPayload(peticion({ area: 230, perimetro: 60 })));
    expect(d.flags.requiresReview).toBe(true);
    expect(d.flags.warnings.join(' ')).toContain('Discrepancia de área');
  });

  it('sin perímetro oficial (la web) se imprime el calculado y es correcto: 60 m', async () => {
    const d = await procesarDatosPlano(PlanoRequestAdapter.toHybridPayload(peticion({ area: 200, perimetro: 0 })));
    expect(d.flags.fuentePerimetro).toBe('CALCULADO');
    expect(d.perimetroFinal).toBeCloseTo(60, 6);
  });

  it('los datos oficiales siguen mandando sobre los calculados (lo que usa mapa_renasur)', async () => {
    const d = await procesarDatosPlano(PlanoRequestAdapter.toHybridPayload(peticion({ area: 200.5, perimetro: 60.2 })));
    expect(d.areaFinal).toBe(200.5);
    expect(d.perimetroFinal).toBe(60.2);
    expect(d.flags.fuenteArea).toBe('REGISTRAL');
  });
});
