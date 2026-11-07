/**
 * Perfil de documento: qué textos y campos usan la memoria descriptiva, el plano
 * de ubicación y la copia del plano perimétrico.
 *
 * - `HABILITACION_URBANA` (por defecto; lo que usa mapa_renasur): lote dentro de un
 *   proyecto inmobiliario. Devuelve EXACTAMENTE los textos de siempre.
 * - `INDUSTRIAL`: lote de un proyecto industrial. Como la habilitación urbana pero con el nombre y las etiquetas del
 *   PROYECTO («Sector», «Módulo»…), sin los textos de «terreno urbano» y con el frente y la potencia del lote si constan.
 *   (Los textos son una propuesta; los aprueba quien firma los documentos.)
 * - `PREDIO`: predio en general (sin proyecto, manzana ni lote). No imprime nombres
 *   de proyecto ni textos de habilitación urbana, y lo que falta aparece como
 *   "No consta" en vez de quedar en blanco o con un valor inventado.
 *
 * Funciones puras: se prueban sin generar PDF.
 */

export type PerfilDocumento = 'HABILITACION_URBANA' | 'PREDIO' | 'INDUSTRIAL';

/** Lo que falta se dice: ni en blanco ni inventado. */
export const NO_CONSTA = 'No consta';

export const esPredio = (perfil?: string): boolean => perfil === 'PREDIO';
export const esIndustrial = (perfil?: string): boolean => perfil === 'INDUSTRIAL';

/** Marca por defecto (la de siempre): se usa cuando el payload no trae el nombre del proyecto. */
const MARCA_LEGADA = 'TERRA LIMA';

/** Nombre del proyecto en mayúsculas para los textos de habilitación urbana e industrial. */
export function marcaDelProyecto(lote: Pick<LoteTextos, 'proyectoNombre'>): string {
  return (lote.proyectoNombre ?? '').trim().toUpperCase() || MARCA_LEGADA;
}

/** Cómo se llaman la agrupación y la unidad: «Manzana»/«Lote» salvo en el perfil industrial con etiquetas propias. */
export function etiquetasDeUnidad(perfil: string | undefined, lote: Pick<LoteTextos, 'etiquetaAgrupador' | 'etiquetaNumero'>): { agrupador: string; numero: string } {
  if (!esIndustrial(perfil)) return { agrupador: 'Manzana', numero: 'Lote' };
  return { agrupador: (lote.etiquetaAgrupador ?? '').trim() || 'Sector', numero: (lote.etiquetaNumero ?? '').trim() || 'Módulo' };
}

const fmtNumero = (n: number): string => n.toLocaleString('es-PE', { maximumFractionDigits: 2 });

/** Subconjunto de `lote` que usan estas funciones. */
export interface LoteTextos {
  codigo?: string;
  nombre?: string;
  manzana?: string;
  etapa?: string;
  numeroLote?: string;
  proyectoNombre?: string;
  etiquetaAgrupador?: string;
  etiquetaNumero?: string;
  frenteM?: number;
  potenciaKw?: number;
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

export function textoGeneralidades(perfil?: string, lote: Pick<LoteTextos, 'proyectoNombre'> = {}): string {
  if (esPredio(perfil)) return TEXTO_GENERALIDADES_PREDIO;
  const marca = marcaDelProyecto(lote);
  if (esIndustrial(perfil))
    return `La presente Memoria Descriptiva tiene por objeto describir técnica y legalmente el lote industrial, delimitando sus linderos y medidas perimétricas, así como su ubicación y área, el cual forma parte del proyecto "${marca}".`;
  // Por defecto: EXACTAMENTE el texto de siempre (con el nombre del proyecto si el payload lo trae).
  return TEXTO_GENERALIDADES_HU.replace('"TERRA LIMA"', `"${marca}"`);
}

/** Sección II de la memoria: identificación y ubicación. */
export function filasIdentificacion(perfil: string | undefined, lote: LoteTextos): FilaDato[] {
  const u = lote.ubicacion;
  if (esIndustrial(perfil)) {
    const et = etiquetasDeUnidad(perfil, lote);
    const filas: FilaDato[] = [
      { label: 'PROYECTO', value: marcaDelProyecto(lote) },
      { label: 'ETAPA', value: lote.etapa || '---' },
      { label: et.agrupador.toUpperCase(), value: lote.manzana || '---' },
      { label: et.numero.toUpperCase(), value: lote.numeroLote || '---' },
      { label: 'CÓDIGO INTERNO', value: lote.codigo || NO_CONSTA },
      { label: 'DEPARTAMENTO', value: u?.departamento || '---' },
      { label: 'PROVINCIA', value: u?.provincia || '---' },
      { label: 'DISTRITO', value: u?.distrito || '---' },
      { label: 'DIRECCIÓN', value: u?.direccion || `${et.agrupador} ${lote.manzana || '---'} ${et.numero} ${lote.numeroLote || '---'}` },
    ];
    if (typeof lote.frenteM === 'number' && lote.frenteM > 0) filas.push({ label: 'FRENTE', value: `${fmtNumero(lote.frenteM)} m` });
    if (typeof lote.potenciaKw === 'number' && lote.potenciaKw > 0) filas.push({ label: 'POTENCIA DISPONIBLE', value: `${fmtNumero(lote.potenciaKw)} kW` });
    return filas;
  }
  if (!esPredio(perfil)) {
    return [
      { label: 'PROYECTO', value: marcaDelProyecto(lote) },
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
  if (u?.urbanizacion && u.urbanizacion.trim().toLowerCase() !== (lote.nombre ?? '').trim().toLowerCase())
    filas.push({ label: 'PROYECTO', value: u.urbanizacion });
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
    const marca = marcaDelProyecto(lote);
    // La marca partida en dos líneas para el logo de texto: «TERRA LIMA» → TERRA / LIMA (un nombre de una sola palabra, en la primera).
    const palabras = marca.split(/\s+/);
    const logoAlternativo: [string, string] = palabras.length > 1
      ? [palabras.slice(0, Math.ceil(palabras.length / 2)).join(' '), palabras.slice(Math.ceil(palabras.length / 2)).join(' ')]
      : [marca, ''];
    return {
      subtituloLogo: esIndustrial(perfil) ? 'Lotización Industrial' : 'Desarrollo Inmobiliario',
      logoAlternativo,
      filas: [
        { l: 'PROYECTO:', v: marca },
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
  if (esIndustrial(perfil)) {
    const et = etiquetasDeUnidad(perfil, lote);
    return {
      marca: marcaDelProyecto(lote),
      proyectoLabel: 'PROYECTO:',
      proyectoValor: lote.etapa || 'Lotización Industrial',
      direccion: direccion || `${et.agrupador} ${lote.manzana} ${et.numero} ${lote.numeroLote}`,
    };
  }
  if (!esPredio(perfil)) {
    return {
      marca: marcaDelProyecto(lote),
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
  if (esIndustrial(perfil)) return `PROYECTO: LOTIZACIÓN INDUSTRIAL "${urbanizacion || NO_CONSTA}"`;
  if (!esPredio(perfil)) return `PROYECTO: HABILITACIÓN URBANA "${urbanizacion || 'TERRA LIMA'}"`;
  return `PREDIO: ${nombre || urbanizacion || NO_CONSTA}`;
}
