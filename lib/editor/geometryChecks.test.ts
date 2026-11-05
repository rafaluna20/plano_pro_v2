import { describe, it, expect } from 'vitest';
import { medidasPoligono, autoIntersecta } from './geometryChecks';

describe('medidasPoligono', () => {
  it('rectángulo 10 x 20', () => {
    const m = medidasPoligono([[0, 0], [10, 0], [10, 20], [0, 20]]);
    expect(m.area).toBe(200);
    expect(m.perimetro).toBe(60);
    expect(m.ancho).toBe(10);
    expect(m.alto).toBe(20);
  });
  it('no depende del sentido horario/antihorario', () => {
    expect(medidasPoligono([[0, 20], [10, 20], [10, 0], [0, 0]]).area).toBe(200);
  });
});

describe('autoIntersecta', () => {
  it('un rectángulo no se cruza', () => {
    expect(autoIntersecta([[0, 0], [10, 0], [10, 20], [0, 20]])).toBe(false);
  });
  it('un corbatín (vértices en orden cruzado) sí', () => {
    expect(autoIntersecta([[0, 0], [10, 20], [10, 0], [0, 20]])).toBe(true);
  });
  it('un polígono cóncavo (en L) no se cruza', () => {
    expect(autoIntersecta([[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]])).toBe(false);
  });
  it('un triángulo no se cruza', () => {
    expect(autoIntersecta([[0, 0], [10, 0], [5, 8]])).toBe(false);
  });
});
