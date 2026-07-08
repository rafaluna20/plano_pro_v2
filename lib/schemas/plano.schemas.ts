/**
 * TIPOS PARA EL STORE (FRONTEND LEGACY) - PROYECTO TERRA LIMA
 *
 * NOTA: Este archivo contenía además un set de esquemas Zod ("API V2")
 * que nunca fueron importados desde ninguna ruta (la validación real de
 * /api/v1/planos/generar vive en lib/validators/schemas.ts). Se eliminaron
 * porque además de estar muertos, tenían defaults hardcodeados peligrosos
 * (ubicacion.departamento/provincia -> 'Lima', distrito -> 'San Juan de
 * Lurigancho') que habrían sustituido en silencio la ubicación real de
 * cualquier proyecto fuera de esa urbanización si alguna vez se hubieran
 * conectado.
 */

export interface Vertice {
  id: string;
  x: number;
  y: number;
}

export interface MembreteData {
  proyecto: string;
  plano: string;
  profesional: string;
  registro: string;
  fecha: string;
  lamina: string;
  escala: string;
}

export interface Dimensiones {
  frente: number;
  fondo: number;
  izquierda: number;
  derecha: number;
  ladoDerecho: number;
  ladoIzquierdo: number;
  area: number;
  perimetro: number;
}

export interface Colindantes {
  frente: string;
  fondo: string;
  izquierda: string;
  derecha: string;
}

export interface LoteVecino {
  id: string;
  nombre: string;
  vertices: Vertice[];
}

export interface LoteData {
  loteId: string;
  propietario: string;
  dimensiones: Dimensiones;
  colindantes: Colindantes;
  membrete: MembreteData;
  vertices: Vertice[];
  contexto: {
    vecinos: LoteVecino[];
  };
  config: {
    usarGoogleMaps: boolean;
  };
}
