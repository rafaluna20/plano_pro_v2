import { describe, it, expect } from 'vitest';
import {
  aplicarPlantilla, empaquetarProyecto, extraerPlantilla, mezclar, nombreSugerido,
  plantillaVacia, resumirProyecto, restaurarProyecto, tamanoBytes, VERSION_PROYECTO,
} from './proyectos';

const BASE = {
  tipoDocumento: 'PREDIO',
  loteId: '',
  propietario: '',
  ubicacionLote: { departamento: '', provincia: '', distrito: '', direccion: '' },
  membrete: { proyecto: '', profesional: '', registro: '', escala: '1/500' },
  vertices: [{ id: 'A', x: 1, y: 2 }],
  contexto: { vecinos: [] as unknown[] },
  config: { modoUbicacion: 'vectorial', campoNuevo: 'por defecto' },
};

describe('restaurarProyecto', () => {
  it('devuelve exactamente lo guardado', () => {
    const editado = {
      ...BASE,
      loteId: 'VILLA SUR 2',
      vertices: [{ id: 'A', x: 10, y: 20 }, { id: 'B', x: 11, y: 21 }, { id: 'C', x: 12, y: 22 }],
      contexto: { vecinos: [{ id: 'v1' }] },
    };
    const r = restaurarProyecto(BASE, empaquetarProyecto(editado));
    expect(r).toEqual(editado);
  });

  it('un proyecto de una versión vieja (sin campos nuevos) abre con los valores por defecto', () => {
    const viejo = { version: 0, data: { loteId: 'P-1', config: { modoUbicacion: 'satelital' } } };
    const r: any = restaurarProyecto(BASE, viejo);
    expect(r.loteId).toBe('P-1');
    expect(r.config.modoUbicacion).toBe('satelital');
    expect(r.config.campoNuevo).toBe('por defecto'); // faltaba: toma el de la base
    expect(r.membrete.escala).toBe('1/500');
    expect(r.vertices).toEqual(BASE.vertices);
  });

  it('los arreglos guardados reemplazan al de la base, no se mezclan', () => {
    const r: any = restaurarProyecto(BASE, { version: 1, data: { vertices: [] } });
    expect(r.vertices).toEqual([]);
  });

  it('rechaza algo que no es un proyecto', () => {
    expect(() => restaurarProyecto(BASE, null)).toThrow();
    expect(() => restaurarProyecto(BASE, { version: 1 })).toThrow();
    expect(() => restaurarProyecto(BASE, { version: 1, data: 'x' })).toThrow();
    expect(() => restaurarProyecto(BASE, [1, 2])).toThrow();
  });

  it('no modifica la base', () => {
    const copia = JSON.parse(JSON.stringify(BASE));
    restaurarProyecto(BASE, { version: 1, data: { loteId: 'X', membrete: { proyecto: 'Y' } } });
    expect(BASE).toEqual(copia);
  });

  it('empaqueta con la versión vigente', () => {
    expect(empaquetarProyecto({ a: 1 })).toEqual({ version: VERSION_PROYECTO, data: { a: 1 } });
  });
});

describe('mezclar', () => {
  it('un valor guardado vacío sí reemplaza al de la base: es lo que el usuario dejó', () => {
    const r: any = mezclar({ a: 'x', b: { c: 'y' } }, { a: '', b: { c: '' } });
    expect(r).toEqual({ a: '', b: { c: '' } });
  });
});

describe('resumen y nombre', () => {
  it('resume lo justo para la lista', () => {
    const d = { loteId: ' VILLA SUR 2 ', propietario: 'Navarro', ubicacionLote: { distrito: 'Chilca' }, vertices: [1, 2, 3], contexto: { vecinos: [1, 2] } };
    expect(resumirProyecto(d)).toEqual({ loteId: 'VILLA SUR 2', propietario: 'Navarro', distrito: 'Chilca', vertices: 3, vecinos: 2 });
  });
  it('resume datos incompletos sin fallar', () => {
    expect(resumirProyecto({})).toEqual({ loteId: '', propietario: '', distrito: '', vertices: 0, vecinos: 0 });
    expect(resumirProyecto(null)).toEqual({ loteId: '', propietario: '', distrito: '', vertices: 0, vecinos: 0 });
  });
  it('el nombre sugerido es el código; si no, el trámite; si no, "Sin título"', () => {
    expect(nombreSugerido({ loteId: 'VILLA SUR 2', membrete: { proyecto: 'Saneamiento' } })).toBe('VILLA SUR 2');
    expect(nombreSugerido({ loteId: ' ', membrete: { proyecto: 'Saneamiento' } })).toBe('Saneamiento');
    expect(nombreSugerido({})).toBe('Sin título');
  });
});

describe('datos frecuentes (plantilla)', () => {
  const lleno = {
    ...BASE,
    loteId: 'P-9',
    propietario: 'Juan',
    ubicacionLote: { departamento: 'Lima', provincia: 'Cañete', distrito: 'Chilca', direccion: 'Km 55' },
    membrete: { proyecto: 'Saneamiento físico legal', profesional: 'Ing. Ana Torres', registro: 'CIP 123456', escala: '1/500' },
  };

  it('extrae solo lo que se repite: no el código, propietario, dirección ni geometría', () => {
    const p = extraerPlantilla(lleno);
    expect(p).toEqual({
      tipoDocumento: 'PREDIO', proyecto: 'Saneamiento físico legal', profesional: 'Ing. Ana Torres',
      registro: 'CIP 123456', departamento: 'Lima', provincia: 'Cañete', distrito: 'Chilca',
    });
    expect(JSON.stringify(p)).not.toMatch(/P-9|Juan|Km 55/);
  });

  it('aplicada a un proyecto nuevo lo rellena y deja intacto el resto', () => {
    const r: any = aplicarPlantilla(BASE, extraerPlantilla(lleno));
    expect(r.membrete.profesional).toBe('Ing. Ana Torres');
    expect(r.membrete.registro).toBe('CIP 123456');
    expect(r.membrete.proyecto).toBe('Saneamiento físico legal');
    expect(r.ubicacionLote.distrito).toBe('Chilca');
    expect(r.ubicacionLote.direccion).toBe('');
    expect(r.loteId).toBe('');
    expect(r.membrete.escala).toBe('1/500');
    expect(r.vertices).toEqual(BASE.vertices);
  });

  it('una plantilla con campos vacíos no borra lo que ya está escrito', () => {
    const r: any = aplicarPlantilla(lleno, { profesional: '', distrito: '' });
    expect(r.membrete.profesional).toBe('Ing. Ana Torres');
    expect(r.ubicacionLote.distrito).toBe('Chilca');
  });

  it('sin plantilla no cambia nada', () => {
    expect(aplicarPlantilla(BASE, null)).toBe(BASE);
    expect(aplicarPlantilla(BASE, undefined)).toBe(BASE);
  });

  it('detecta una plantilla vacía', () => {
    expect(plantillaVacia(null)).toBe(true);
    expect(plantillaVacia({ proyecto: '', distrito: '' })).toBe(true);
    expect(plantillaVacia({ distrito: 'Chilca' })).toBe(false);
  });
});

describe('tamanoBytes', () => {
  it('cuenta bytes reales (UTF-8), no caracteres', () => {
    expect(tamanoBytes('ñ')).toBe(4); // comillas (2) + ñ en UTF-8 (2)
    expect(tamanoBytes({ a: 1 })).toBe(7);
  });
});
