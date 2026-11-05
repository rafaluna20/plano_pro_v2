/**
 * Textos del membrete del plano perimétrico para el perfil PREDIO.
 *
 * Solo se usa con `perfil = PREDIO`: el membrete de habilitación urbana (el de
 * mapa_renasur) no pasa por aquí y sigue idéntico. Funciones puras, sin PDF.
 *
 * Cada dato que falta se imprime como "No consta": nunca en blanco ni inventado.
 */
import { NO_CONSTA } from './perfilDocumento';

/** Profesional que firma el plano. Todos los campos son opcionales. */
export interface ProfesionalResponsable {
  nombre?: string;
  /** Colegiatura tal como se escribe, p. ej. "CIP 123456" o "CAP 98765". */
  colegiatura?: string;
}

export interface DatosMembretePredio {
  denominacion?: string;
  sector?: string;
  propietario?: string;
  direccion?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  zonaUTM?: number;
  profesional?: ProfesionalResponsable;
  formatoPapel?: string;
}

export interface FilasMembretePredio {
  predio: string;
  propietario: string;
  ubicacion: string;
  sistema: string;
  profesional: string;
  etiquetaEscala: string;
}

const limpio = (s?: string) => (s ?? '').trim();

/**
 * Fecha dd/mm/aaaa en hora del Perú. Antes el plano usaba `toLocaleDateString()` sin
 * idioma: en el servidor salía "11/5/2026" (mes/día, formato EE. UU.), que un lector
 * peruano entiende como 11 de mayo. Se arma a mano para no depender del idioma del
 * servidor, y con la zona horaria de Lima para que de noche no salte al día siguiente.
 */
export function fechaPeru(d: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${v('day')}/${v('month')}/${v('year')}`;
}

export function filasMembretePredio(d: DatosMembretePredio): FilasMembretePredio {
  // Sin sector, el adaptador usa el nombre del predio como "urbanización": no se repite en la
  // ubicación ("..., villa sur 2, Pucusana...") cuando es lo mismo que la denominación.
  const sector = limpio(d.sector).toLowerCase() === limpio(d.denominacion).toLowerCase() ? '' : d.sector;
  const ubicacion = [d.direccion, sector, d.distrito, d.provincia, d.departamento]
    .map(limpio)
    .filter(Boolean)
    .join(', ');

  const nombre = limpio(d.profesional?.nombre);
  const colegiatura = limpio(d.profesional?.colegiatura);

  return {
    predio: limpio(d.denominacion) || limpio(d.sector) || NO_CONSTA,
    propietario: limpio(d.propietario) || NO_CONSTA,
    ubicacion: ubicacion || NO_CONSTA,
    sistema: `UTM WGS84 - zona ${d.zonaUTM ?? 18}S`,
    profesional: nombre && colegiatura ? `${nombre} - ${colegiatura}` : nombre || colegiatura || NO_CONSTA,
    // La escala impresa solo vale si se imprime en este papel: se conserva el dato, junto a la escala.
    etiquetaEscala: `ESCALA (${(d.formatoPapel || 'A3').toUpperCase()}):`,
  };
}

/** Texto del rótulo del predio dentro del dibujo (en habilitación urbana es "LOTE n"). */
export function rotuloPredioEnPlano(denominacion?: string): string {
  return limpio(denominacion).toUpperCase() || 'PREDIO';
}

/**
 * Medidas del membrete del predio (mm). Letras un 10 % más pequeñas que el membrete de
 * habilitación urbana (etiquetas 6 -> 5.4 pt, valores 8 -> 7.2 pt) y sin recuadro de firma.
 * La fila de UBICACIÓN es más alta porque admite hasta 3 líneas: las direcciones reales son
 * largas y antes se cortaban con "...".
 */
export const MEMBRETE_PREDIO = {
  FACTOR_FUENTE: 0.9,
  /** PREDIO, PROPIETARIO, UBICACIÓN (3 líneas), ÁREA/PERÍMETRO, ESCALA/FECHA, SISTEMA, PROFESIONAL */
  FILAS_MM: [8.5, 8.5, 12, 8.5, 8.5, 8.5, 8.5],
  MAX_LINEAS_UBICACION: 3,
} as const;

export const ALTURA_MEMBRETE_PREDIO_MM: number = MEMBRETE_PREDIO.FILAS_MM.reduce((a, b) => a + b, 0);
