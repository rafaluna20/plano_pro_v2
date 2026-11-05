/**
 * Comprobaciones geométricas simples sobre un polígono en metros (UTM), para la
 * vista previa del modal de importación. Sin dependencias; planas (no
 * geodésicas): válidas para lotes, que es para lo que se usan.
 */

export type Punto = [number, number];

export interface Medidas {
  /** m² */
  area: number;
  /** m, incluyendo el lado de cierre */
  perimetro: number;
  /** extensión E-O en m */
  ancho: number;
  /** extensión N-S en m */
  alto: number;
}

export function medidasPoligono(v: Punto[]): Medidas {
  let s = 0;
  let per = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    s += a[0] * b[1] - b[0] * a[1];
    per += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const xs = v.map((p) => p[0]);
  const ys = v.map((p) => p[1]);
  return {
    area: Math.abs(s) / 2,
    perimetro: per,
    ancho: Math.max(...xs) - Math.min(...xs),
    alto: Math.max(...ys) - Math.min(...ys),
  };
}

const cruz = (o: Punto, a: Punto, b: Punto) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** ¿Los segmentos AB y CD se cruzan de verdad (no solo se tocan en un extremo)? */
function seCruzan(a: Punto, b: Punto, c: Punto, d: Punto): boolean {
  const d1 = cruz(c, d, a);
  const d2 = cruz(c, d, b);
  const d3 = cruz(a, b, c);
  const d4 = cruz(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** ¿El contorno se cruza a sí mismo (forma de "corbatín")? O(n²). */
export function autoIntersecta(v: Punto[]): boolean {
  const n = v.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = v[i];
    const b = v[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // lados contiguos comparten un vértice: no cuentan
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (seCruzan(a, b, v[j], v[(j + 1) % n])) return true;
    }
  }
  return false;
}
