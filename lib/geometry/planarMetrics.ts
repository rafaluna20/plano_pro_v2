/**
 * Área y perímetro en METROS para contornos en coordenadas proyectadas (UTM).
 *
 * Por qué existe: `PlanoDataProcessor` calculaba área y perímetro con `turf.area` /
 * `turf.length`, que esperan GRADOS (lon/lat). Los payloads de plan_pro llevan la
 * geometría en UTM (metros), así que turf leía "284500, 8670100" como grados y
 * devolvía áreas de billones de m² y perímetros de millones de metros (un lote de
 * 10 x 20 m daba 2 024 175 854 887 m² y 6 260 878 m). Estas funciones hacen la
 * cuenta plana correcta.
 */

/** ¿Todas las coordenadas caben en rangos de grados (|x|<=180, |y|<=90)? Un Este UTM
 *  válido nunca baja de ~100 000, así que no hay falsos positivos. */
export function parecenGrados(anillo: number[][]): boolean {
  return anillo.length > 0 && anillo.every((c) => Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90);
}

/** Área (m²) por la fórmula del topógrafo (shoelace). Acepta el anillo abierto o
 *  cerrado (si repite el primer punto al final, ese término suma 0). */
export function areaPlanaM2(anillo: number[][]): number {
  let s = 0;
  for (let i = 0; i < anillo.length; i++) {
    const a = anillo[i];
    const b = anillo[(i + 1) % anillo.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/** Perímetro (m): suma de lados, incluido el de cierre si el anillo viene abierto. */
export function perimetroPlanoM(anillo: number[][]): number {
  let per = 0;
  for (let i = 0; i < anillo.length; i++) {
    const a = anillo[i];
    const b = anillo[(i + 1) % anillo.length];
    per += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return per;
}
