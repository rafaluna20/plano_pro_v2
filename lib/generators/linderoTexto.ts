/**
 * Redacción de la colindancia de un lindero en la Memoria Descriptiva.
 *
 * `col.tipo` llega desde mapa_renasur tal cual el código de la capa de Odoo
 * (elemento.urbano.capa: "aporte_recreacion", "jardin", "area_verde"...), un
 * identificador interno con guion bajo. Imprimirlo crudo dejaba frases como
 * 'Colinda con el aporte_recreacion "Aporte Recreación Pública 05"' en un
 * documento legal. Acá se traduce a un sustantivo con su artículo.
 *
 * Las capas son dinámicas (un admin puede crear una nueva en Odoo sin tocar
 * código): un código que no está en la tabla igual se imprime legible (sin
 * guiones bajos), solo que sin redacción especial.
 */
const SUJETO_POR_CAPA: Record<string, string> = {
  lote: 'el lote',
  aporte_recreacion: 'el aporte para recreación pública',
  aporte_educacion: 'el aporte para educación',
  aporte_otros: 'el aporte para otros fines',
  area_verde: 'el área verde',
  jardin: 'el jardín',
  veredas: 'la vereda',
  pistas: 'la pista',
  agua: 'el cuerpo de agua',
  matriz: 'el predio matriz',
};

/** Tipos que se redactan sin artículo: 'Colinda con calle "Calle 12"'. */
const TIPOS_VIA = new Set(['calle', 'via', 'av']);

export function esTipoVia(tipo: string | undefined | null): boolean {
  return TIPOS_VIA.has((tipo ?? '').trim().toLowerCase());
}

/** "el lote", "el jardín", "el aporte para recreación pública"... */
export function sujetoColindante(tipo: string | undefined | null): string {
  const codigo = (tipo ?? '').trim().toLowerCase();
  if (!codigo) return 'el elemento colindante';
  return SUJETO_POR_CAPA[codigo] ?? `el ${codigo.replace(/_+/g, ' ')}`;
}

/**
 * Frase completa de la colindancia, sin la terminación de medida:
 * 'Colinda con el jardín "jardin 327"' / 'Colinda con calle "calle 12"'.
 */
export function fraseColindancia(col: { tipo?: string | null; nombre?: string | null; propietario?: string | null }): string {
  const nombre = col.nombre || '---';
  if (esTipoVia(col.tipo)) {
    return `Colinda con ${col.tipo} "${nombre}"`;
  }
  const propInfo = col.propietario ? `, propiedad de ${col.propietario}` : '';
  return `Colinda con ${sujetoColindante(col.tipo)} "${nombre}"${propInfo}`;
}
