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
  /** Proyecto / objeto del trámite, p. ej. "Saneamiento físico legal". */
  proyecto?: string;
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
  proyecto: string;
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
  // Sin proyecto, el adaptador usa el nombre del predio como "urbanización": si el proyecto es
  // igual a la denominación es ese relleno, no un proyecto real, y se trata como ausente.
  const proyecto = limpio(d.proyecto).toLowerCase() === limpio(d.denominacion).toLowerCase() ? '' : limpio(d.proyecto);
  const ubicacion = [d.direccion, d.distrito, d.provincia, d.departamento]
    .map(limpio)
    .filter(Boolean)
    .join(', ');

  const nombre = limpio(d.profesional?.nombre);
  const colegiatura = limpio(d.profesional?.colegiatura);

  return {
    proyecto: proyecto || NO_CONSTA,
    predio: limpio(d.denominacion) || NO_CONSTA,
    propietario: limpio(d.propietario) || NO_CONSTA,
    ubicacion: ubicacion || NO_CONSTA,
    sistema: `UTM WGS84 - zona ${d.zonaUTM ?? 18}S`,
    profesional: nombre && colegiatura ? `${nombre} - ${colegiatura}` : nombre || colegiatura || NO_CONSTA,
    // La escala impresa solo vale si se imprime en este papel: se conserva el dato, junto a la escala.
    etiquetaEscala: `ESCALA (${(d.formatoPapel || 'A3').toUpperCase()}):`,
  };
}

/**
 * Texto del rótulo del predio dentro del dibujo (en habilitación urbana es "LOTE n"): la
 * denominación; si falta, el sector; y solo si no hay ninguno, "PREDIO".
 */
export function rotuloPredioEnPlano(denominacion?: string, sector?: string): string {
  return (limpio(denominacion) || limpio(sector)).toUpperCase() || 'PREDIO';
}

/**
 * Medidas del membrete del predio (mm), sin logo ni recuadro de firma. Letras al tamaño
 * original del plano (etiquetas 6 pt, valores 8 pt). La fila de UBICACIÓN es más alta porque
 * admite hasta 3 líneas: las direcciones reales son largas y antes se cortaban con "...".
 *
 * Orden: PROYECTO, PROPIETARIO, PREDIO (cada uno en una sola línea, etiqueta y valor juntos),
 * UBICACIÓN, [ÁREA | PERÍMETRO], [ESCALA | FECHA | SISTEMA DE COORDENADAS], PROFESIONAL RESPONSABLE.
 */
export const MEMBRETE_PREDIO = {
  FACTOR_FUENTE: 1,
  FILAS_MM: [7, 7, 7, 13, 9.5, 9.5, 9.5],
  MAX_LINEAS_UBICACION: 3,
} as const;

export const ALTURA_MEMBRETE_PREDIO_MM: number = MEMBRETE_PREDIO.FILAS_MM.reduce((a, b) => a + b, 0);
