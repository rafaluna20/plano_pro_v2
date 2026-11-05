/**
 * Perfil de documento: qué textos y campos usan la memoria descriptiva, el plano
 * de ubicación y la copia del plano perimétrico.
 *
 * - `HABILITACION_URBANA` (por defecto; lo que usa mapa_renasur): lote dentro de un
 *   proyecto inmobiliario. Devuelve EXACTAMENTE los textos de siempre.
 * - `PREDIO`: predio en general (sin proyecto, manzana ni lote). No imprime nombres
 *   de proyecto ni textos de habilitación urbana, y lo que falta aparece como
 *   "No consta" en vez de quedar en blanco o con un valor inventado.
 *
 * Funciones puras: se prueban sin generar PDF.
 */

export type PerfilDocumento = 'HABILITACION_URBANA' | 'PREDIO';

/** Lo que falta se dice: ni en blanco ni inventado. */
export const NO_CONSTA = 'No consta';

export const esPredio = (perfil?: string): boolean => perfil === 'PREDIO';

/** Subconjunto de `lote` que usan estas funciones. */
export interface LoteTextos {
  codigo?: string;
  nombre?: string;
  manzana?: string;
  etapa?: string;
  numeroLote?: string;
  ubicacion?: {
    departamento?: string;
    provincia?: string;
    distrito?: string;
    urbanizacion?: string;
    direccion?: string;
    zonaUTM?: number;
  };
}

export interface FilaDato {
  label: string;
  value: string;
}

const TEXTO_GENERALIDADES_HU =
  'La presente Memoria Descriptiva tiene por objeto describir técnica y legalmente el lote de terreno urbano, delimitando sus linderos y medidas perimétricas, así como su ubicación y área, el cual forma parte del proyecto inmobiliario "TERRA LIMA".';

const TEXTO_GENERALIDADES_PREDIO =
  'La presente Memoria Descriptiva tiene por objeto describir técnicamente el predio, delimitando sus linderos y medidas perimétricas, así como su ubicación y área.';

export function textoGeneralidades(perfil?: string): string {
  return esPredio(perfil) ? TEXTO_GENERALIDADES_PREDIO : TEXTO_GENERALIDADES_HU;
}

/** Sección II de la memoria: identificación y ubicación. */
export function filasIdentificacion(perfil: string | undefined, lote: LoteTextos): FilaDato[] {
  const u = lote.ubicacion;
  if (!esPredio(perfil)) {
    return [
      { label: 'PROYECTO', value: 'TERRA LIMA' },
      { label: 'ETAPA', value: lote.etapa || '---' },
      { label: 'MANZANA', value: lote.manzana as string },
      { label: 'LOTE', value: lote.numeroLote as string },
      { label: 'CÓDIGO INTERNO', value: lote.codigo as string },
      { label: 'DEPARTAMENTO', value: u?.departamento || '---' },
      { label: 'PROVINCIA', value: u?.provincia || '---' },
      { label: 'DISTRITO', value: u?.distrito || '---' },
      { label: 'DIRECCIÓN', value: u?.direccion || `Mz. ${lote.manzana} Lote ${lote.numeroLote}` },
    ];
  }
  const filas: FilaDato[] = [
    { label: 'DENOMINACIÓN', value: lote.nombre || lote.codigo || NO_CONSTA },
  ];
  if (lote.codigo && lote.codigo !== lote.nombre) filas.push({ label: 'CÓDIGO', value: lote.codigo });
  if (u?.urbanizacion) filas.push({ label: 'SECTOR / URBANIZACIÓN', value: u.urbanizacion });
  filas.push(
    { label: 'DEPARTAMENTO', value: u?.departamento || NO_CONSTA },
    { label: 'PROVINCIA', value: u?.provincia || NO_CONSTA },
    { label: 'DISTRITO', value: u?.distrito || NO_CONSTA },
    { label: 'DIRECCIÓN / UBICACIÓN', value: u?.direccion || NO_CONSTA },
    // Datum y zona: el generador trabaja siempre en UTM WGS84; se declara en el documento.
    { label: 'SISTEMA DE COORDENADAS', value: `UTM WGS84 - zona ${u?.zonaUTM ?? 18}S` },
  );
  return filas;
}

/** Encabezado de cada página de la memoria. */
export function encabezadoMemoria(
  perfil: string | undefined,
  lote: LoteTextos,
  fecha: string,
): { subtituloLogo: string | null; logoAlternativo: [string, string] | null; filas: { l: string; v: string }[] } {
  if (!esPredio(perfil)) {
    return {
      subtituloLogo: 'Desarrollo Inmobiliario',
      logoAlternativo: ['TERRA', 'LIMA'],
      filas: [
        { l: 'PROYECTO:', v: 'TERRA LIMA' },
        { l: 'DOCUMENTO:', v: 'MEMORIA DESCRIPTIVA' },
        { l: 'CÓDIGO:', v: lote.codigo || '---' },
        { l: 'FECHA:', v: fecha },
      ],
    };
  }
  return {
    subtituloLogo: null,
    logoAlternativo: null,
    filas: [
      { l: 'DOCUMENTO:', v: 'MEMORIA DESCRIPTIVA' },
      { l: 'CÓDIGO:', v: lote.codigo || NO_CONSTA },
      { l: 'FECHA:', v: fecha },
    ],
  };
}

/** Cajetín del plano de ubicación (bajo el logo e información del predio). */
export function cajetinUbicacion(
  perfil: string | undefined,
  lote: LoteTextos,
): { marca: string | null; proyectoLabel: string; proyectoValor: string; direccion: string } {
  const direccion = lote.ubicacion?.direccion;
  if (!esPredio(perfil)) {
    return {
      marca: 'TERRA LIMA',
      proyectoLabel: 'PROYECTO:',
      proyectoValor: lote.etapa || 'Habilitación Urbana',
      direccion: direccion || `Mz. ${lote.manzana} Lote ${lote.numeroLote}`,
    };
  }
  return {
    marca: null,
    proyectoLabel: 'PREDIO:',
    proyectoValor: lote.nombre || lote.codigo || NO_CONSTA,
    direccion: direccion || NO_CONSTA,
  };
}

/** Línea "PROYECTO" del cajetín de la copia del plano perimétrico. */
export function lineaProyectoCopia(
  perfil: string | undefined,
  urbanizacion: string | undefined,
  nombre: string | undefined,
): string {
  if (!esPredio(perfil)) return `PROYECTO: HABILITACIÓN URBANA "${urbanizacion || 'TERRA LIMA'}"`;
  return `PREDIO: ${nombre || urbanizacion || NO_CONSTA}`;
}
