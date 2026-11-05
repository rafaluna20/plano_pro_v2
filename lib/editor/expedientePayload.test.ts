import { describe, it, expect } from 'vitest';
import { generarPlanosSchema } from '@/lib/validators/apiSchemas';
import {
  construirPayloadExpediente,
  type EntradaExpediente,
} from './expedientePayload';

// Rectángulo 10 m (E-O) x 20 m (N-S). Vértices en sentido horario desde NO.
const rect = [
  { id: 'A', x: 1000, y: 2020 }, // NO
  { id: 'B', x: 1010, y: 2020 }, // NE
  { id: 'C', x: 1010, y: 2000 }, // SE
  { id: 'D', x: 1000, y: 2000 }, // SO
];

const base = (): EntradaExpediente => ({
  loteId: 'MZ-C-Lote14',
  propietario: 'Titular de Prueba SAC',
  titularDoc: { tipo: 'RUC', numero: '20123456789' },
  ubicacion: {
    departamento: 'Lima',
    provincia: 'Lima',
    distrito: 'Pucusana',
    direccion: '',
  },
  proyecto: 'Proyecto de Prueba',
  vertices: rect,
  vecinos: [],
  adyacentes: {
    norte: { lote: 'Lote 01', propietario: '', dimension: 0 },
    este: { lote: 'Calle 2', propietario: '', dimension: 0 },
    sur: { lote: 'Lote 03', propietario: 'Ana Pérez', dimension: 0 },
    oeste: { lote: 'Lote 04', propietario: '', dimension: 0 },
  },
});

describe('construirPayloadExpediente', () => {
  it('asigna cada colindante a su lado real y usa la longitud geométrica', () => {
    const r = construirPayloadExpediente(base());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const por = Object.fromEntries(r.payload.colindancias.map((c) => [c.lado, c]));
    expect(por.norte.nombre).toBe('Lote 01');
    expect(por.norte.longitud).toBe(10); // arista A→B
    expect(por.este.nombre).toBe('Calle 2');
    expect(por.este.longitud).toBe(20); // arista B→C
    expect(por.sur.propietario).toBe('Ana Pérez');
    expect(por.oeste.longitud).toBe(20);
  });

  it('calcula área y perímetro desde los vértices', () => {
    const r = construirPayloadExpediente(base());
    if (!r.ok) throw new Error('debía ser ok');
    expect(r.payload.dimensiones.area).toBe(200);
    expect(r.payload.dimensiones.perimetro).toBe(60);
    expect(r.payload.dimensiones.frente).toBe(20);
  });

  it('arma la identificación, la ubicación real y el RUC del titular', () => {
    const r = construirPayloadExpediente(base());
    if (!r.ok) throw new Error('debía ser ok');
    expect(r.payload.lote.manzana).toBe('C');
    expect(r.payload.lote.numeroLote).toBe('14');
    expect(r.payload.lote.ubicacion.distrito).toBe('Pucusana');
    expect(r.payload.lote.ubicacion.urbanizacion).toBe('Proyecto de Prueba');
    expect(r.payload.propietario).toEqual({
      nombre: 'Titular de Prueba SAC',
      ruc: '20123456789',
    });
  });

  it('rechaza si falta un colindante, nombrando el lado', () => {
    const e = base();
    e.adyacentes.este = { lote: '  ', propietario: '', dimension: 0 };
    const r = construirPayloadExpediente(e);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores.join(' ')).toContain('este');
  });

  it('rechaza un lote de área cero', () => {
    const e = base();
    e.vertices = [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 5, y: 0 },
      { id: 'C', x: 10, y: 0 },
      { id: 'D', x: 15, y: 0 },
    ];
    const r = construirPayloadExpediente(e);
    expect(r.ok).toBe(false);
  });

  it('con un lote de 5 vértices genera sin linderos y avisa', () => {
    const e = base();
    e.vertices = [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 10, y: 0 },
      { id: 'C', x: 12, y: 8 },
      { id: 'D', x: 5, y: 12 },
      { id: 'E', x: -2, y: 8 },
    ];
    const r = construirPayloadExpediente(e);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.colindancias).toEqual([]);
    expect(r.advertencias.join(' ')).toContain('5 vértices');
  });

  it('un CE o pasaporte no se envía y se avisa', () => {
    const e = base();
    e.titularDoc = { tipo: 'CE', numero: '123456789' };
    const r = construirPayloadExpediente(e);
    if (!r.ok) throw new Error('debía ser ok');
    expect(r.payload.propietario).toEqual({ nombre: 'Titular de Prueba SAC' });
    expect(r.advertencias.join(' ')).toContain('CE');
  });

  it('incluye los vecinos con geometría como contexto', () => {
    const e = base();
    e.vecinos = [
      {
        id: 'V1',
        nombre: 'Lote 02',
        vertices: [
          { id: '1', x: 1010, y: 2020 },
          { id: '2', x: 1020, y: 2020 },
          { id: '3', x: 1020, y: 2000 },
        ],
      },
      { id: 'V2', nombre: 'Sin geometría', vertices: [] },
    ];
    const r = construirPayloadExpediente(e);
    if (!r.ok) throw new Error('debía ser ok');
    expect(r.payload.contexto?.elementos).toHaveLength(1);
    expect(r.payload.contexto?.elementos[0].texto).toBe('Lote 02');
  });

  it('el payload completo pasa el esquema que valida el servidor (/generar)', () => {
    const e = base();
    e.vecinos = [
      {
        id: 'V1',
        nombre: 'Lote 02',
        vertices: [
          { id: '1', x: 1010, y: 2020 },
          { id: '2', x: 1020, y: 2020 },
          { id: '3', x: 1020, y: 2000 },
        ],
      },
    ];
    const r = construirPayloadExpediente(e);
    if (!r.ok) throw new Error('debía ser ok');
    const v = generarPlanosSchema.safeParse(r.payload);
    expect(v.success, JSON.stringify(v.success ? '' : v.error.format())).toBe(true);
  });
});
