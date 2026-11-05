import { describe, it, expect } from 'vitest';
import { cajaDe, distanciaEntreCajas, seleccionarCercanos, type Punto } from './vecinosSeleccion';

const rect = (x0: number, y0: number, w = 10, h = 20): Punto[] => [
  [x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h],
];
const LOTE = rect(1000, 2000);

describe('distanciaEntreCajas', () => {
  it('0 si se tocan o se solapan', () => {
    expect(distanciaEntreCajas(cajaDe(rect(0, 0)), cajaDe(rect(10, 0)))).toBe(0); // comparten lado
    expect(distanciaEntreCajas(cajaDe(rect(0, 0)), cajaDe(rect(5, 5)))).toBe(0); // solapan
  });
  it('separados en un solo eje: la diferencia', () => {
    expect(distanciaEntreCajas(cajaDe(rect(0, 0)), cajaDe(rect(110, 0)))).toBe(100);
  });
  it('en diagonal: hipotenusa entre las esquinas más cercanas', () => {
    // A = [0..10]x[0..20]; B = [40..50]x[60..80] -> dx 30, dy 40 -> 50
    expect(distanciaEntreCajas(cajaDe(rect(0, 0)), cajaDe(rect(40, 60)))).toBe(50);
  });
});

describe('seleccionarCercanos', () => {
  const todos = [
    { nombre: 'Pegado', vertices: rect(1010, 2000) },
    { nombre: 'A 50 m', vertices: rect(1060, 2000) },
    { nombre: 'A 500 m', vertices: rect(1510, 2000) },
    { nombre: 'Lejano 5 km', vertices: rect(6000, 2000) },
    { nombre: 'Inválido', vertices: [[0, 0], [1, 1]] as Punto[] },
  ];

  it('deja solo los que están dentro del radio', () => {
    const r = seleccionarCercanos(todos, LOTE, 100).map((p) => p.nombre);
    expect(r).toEqual(['Pegado', 'A 50 m']);
  });
  it('un radio mayor incluye más', () => {
    expect(seleccionarCercanos(todos, LOTE, 600).map((p) => p.nombre)).toEqual(['Pegado', 'A 50 m', 'A 500 m']);
  });
  it('excluye el propio lote de referencia', () => {
    const conPropio = [{ nombre: 'Yo mismo', vertices: LOTE }, ...todos];
    expect(seleccionarCercanos(conPropio, LOTE, 100).map((p) => p.nombre)).not.toContain('Yo mismo');
  });
  it('un polígono grande que rodea al lote cuenta como cercano (no depende del centroide)', () => {
    const manzana = { nombre: 'Manzana', vertices: rect(0, 0, 3000, 4000) };
    expect(seleccionarCercanos([manzana], LOTE, 10)).toHaveLength(1);
  });
});
