/* eslint-disable @typescript-eslint/no-explicit-any -- el estado del editor llega como JSON sin tipo estático */
/**
 * Proyectos guardados del editor web: funciones puras (sin red ni React).
 *
 * El editor guarda su estado completo (`data`) como JSON. Para abrirlo se mezcla sobre el
 * estado inicial vigente: así un proyecto guardado con una versión anterior del editor
 * (sin campos nuevos) sigue abriendo, con los valores por defecto en lo que le falte.
 */

export const VERSION_PROYECTO = 1;

/** Vercel rechaza cuerpos de más de 4.5 MB: se avisa antes de intentar guardar. */
export const LIMITE_BYTES_PROYECTO = 4_000_000;

export interface ProyectoGuardado<T = Record<string, unknown>> {
  version: number;
  data: T;
}

export interface ResumenProyecto {
  loteId: string;
  propietario: string;
  distrito: string;
  vertices: number;
  vecinos: number;
}

export interface PlantillaDatos {
  tipoDocumento?: string;
  proyecto?: string;
  profesional?: string;
  registro?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function empaquetarProyecto<T>(data: T): ProyectoGuardado<T> {
  return { version: VERSION_PROYECTO, data };
}

export function tamanoBytes(valor: unknown): number {
  return new TextEncoder().encode(JSON.stringify(valor)).length;
}

/**
 * Mezcla lo guardado sobre `base`: los objetos se combinan campo a campo; los arreglos y
 * los valores simples guardados reemplazan al de `base`. Un campo que no está en lo
 * guardado conserva el valor de `base`.
 */
export function mezclar<T>(base: T, guardado: unknown): T {
  if (!esObjeto(base) || !esObjeto(guardado)) {
    return (guardado === undefined ? base : guardado) as T;
  }
  const salida: Record<string, unknown> = { ...base };
  for (const [clave, valor] of Object.entries(guardado)) {
    salida[clave] = clave in base ? mezclar((base as Record<string, unknown>)[clave], valor) : valor;
  }
  return salida as T;
}

/** Reconstruye el estado del editor desde un proyecto guardado. Lanza si no tiene la forma esperada. */
export function restaurarProyecto<T>(base: T, guardado: unknown): T {
  if (!esObjeto(guardado) || !esObjeto(guardado.data)) {
    throw new Error('El proyecto guardado no tiene el formato esperado.');
  }
  return mezclar(base, guardado.data);
}

export function resumirProyecto(data: any): ResumenProyecto {
  return {
    loteId: texto(data?.loteId),
    propietario: texto(data?.propietario),
    distrito: texto(data?.ubicacionLote?.distrito),
    vertices: Array.isArray(data?.vertices) ? data.vertices.length : 0,
    vecinos: Array.isArray(data?.contexto?.vecinos) ? data.contexto.vecinos.length : 0,
  };
}

/** Nombre que se propone al guardar: el código del predio; si no hay, el trámite; si no, "Sin título". */
export function nombreSugerido(data: any): string {
  return texto(data?.loteId) || texto(data?.membrete?.proyecto) || 'Sin título';
}

/** Lo que se repite entre proyectos. No incluye geometría, código, propietario ni vecinos. */
export function extraerPlantilla(data: any): PlantillaDatos {
  return {
    tipoDocumento: texto(data?.tipoDocumento),
    proyecto: texto(data?.membrete?.proyecto),
    profesional: texto(data?.membrete?.profesional),
    registro: texto(data?.membrete?.registro),
    departamento: texto(data?.ubicacionLote?.departamento),
    provincia: texto(data?.ubicacionLote?.provincia),
    distrito: texto(data?.ubicacionLote?.distrito),
  };
}

/** Rellena el estado con la plantilla. Solo usa los campos con valor: nunca borra lo ya escrito con vacíos. */
export function aplicarPlantilla<T>(data: T, plantilla: PlantillaDatos | null | undefined): T {
  if (!plantilla) return data;
  const d = data as any;
  const p = plantilla;
  return {
    ...d,
    tipoDocumento: p.tipoDocumento || d.tipoDocumento,
    membrete: {
      ...d.membrete,
      proyecto: p.proyecto || d.membrete?.proyecto,
      profesional: p.profesional || d.membrete?.profesional,
      registro: p.registro || d.membrete?.registro,
    },
    ubicacionLote: {
      ...d.ubicacionLote,
      departamento: p.departamento || d.ubicacionLote?.departamento,
      provincia: p.provincia || d.ubicacionLote?.provincia,
      distrito: p.distrito || d.ubicacionLote?.distrito,
    },
  } as T;
}

export function plantillaVacia(p: PlantillaDatos | null | undefined): boolean {
  return !p || Object.values(p).every((v) => !v);
}
