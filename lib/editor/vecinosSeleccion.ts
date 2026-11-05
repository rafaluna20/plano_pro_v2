/**
 * Selección de polígonos al importar vecinos en bloque.
 *
 * Un archivo de proyecto puede traer más de mil polígonos (lotes, manzanas, calles).
 * Importarlos todos como "vecinos" de un solo lote hace pesados el editor y los PDF,
 * y casi todos quedan a kilómetros y no aportan nada al plano. Por eso se ofrece
 * importar todos o solo los cercanos al lote, medidos por la distancia entre cajas
 * envolventes (0 si se tocan o se solapan): barato, y sin falsos descartes para
 * polígonos grandes o alargados, que con el centroide sí fallarían.
 */

export type Punto = [number, number];
export interface Caja { minX: number; minY: number; maxX: number; maxY: number }
export interface PoligonoNombrado { nombre: string; vertices: Punto[] }

export function cajaDe(v: Punto[]): Caja {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of v) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Distancia (m) entre dos cajas; 0 si se tocan o se solapan. */
export function distanciaEntreCajas(a: Caja, b: Caja): number {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(0, a.minY - b.maxY, b.minY - a.maxY);
  return Math.hypot(dx, dy);
}

/**
 * Polígonos a menos de `radioM` metros del lote de referencia. Se excluye el
 * propio lote (misma caja que la referencia), porque no es vecino de sí mismo.
 */
export function seleccionarCercanos(
  poligonos: PoligonoNombrado[],
  referencia: Punto[],
  radioM: number,
): PoligonoNombrado[] {
  const ref = cajaDe(referencia);
  return poligonos.filter((p) => {
    if (p.vertices.length < 3) return false;
    const c = cajaDe(p.vertices);
    const esElMismo =
      Math.abs(c.minX - ref.minX) < 0.01 && Math.abs(c.maxX - ref.maxX) < 0.01 &&
      Math.abs(c.minY - ref.minY) < 0.01 && Math.abs(c.maxY - ref.maxY) < 0.01;
    return !esElMismo && distanciaEntreCajas(c, ref) <= radioM;
  });
}
