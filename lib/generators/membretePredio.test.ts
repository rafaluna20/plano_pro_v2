import { describe, it, expect } from 'vitest';
import { fechaPeru, filasMembretePredio, rotuloPredioEnPlano } from './membretePredio';

describe('fechaPeru', () => {
  it('da dd/mm/aaaa (día primero), no mm/dd', () => {
    expect(fechaPeru(new Date('2026-11-05T15:00:00Z'))).toBe('05/11/2026');
  });
  it('usa la hora de Lima: a las 23:00 en Lima sigue siendo el mismo día aunque en UTC ya sea el siguiente', () => {
    // 2026-11-06T04:00Z = 2026-11-05 23:00 en Lima (UTC-5)
    expect(fechaPeru(new Date('2026-11-06T04:00:00Z'))).toBe('05/11/2026');
  });
  it('rellena con ceros', () => {
    expect(fechaPeru(new Date('2026-03-04T15:00:00Z'))).toBe('04/03/2026');
  });
});

describe('filasMembretePredio', () => {
  const completo = {
    denominacion: 'Fundo La Esperanza - Parcela 05',
    sector: 'Sector Los Olivos',
    propietario: 'Juan Pérez Soto',
    direccion: 'Km 12 Carretera Panamericana Sur',
    distrito: 'Subtanjalla',
    provincia: 'Ica',
    departamento: 'Ica',
    profesional: { nombre: 'Ing. Ana Torres Ríos', colegiatura: 'CIP 123456' },
    formatoPapel: 'a3',
  };

  it('arma todas las filas con los datos completos', () => {
    const f = filasMembretePredio(completo);
    expect(f.predio).toBe('Fundo La Esperanza - Parcela 05');
    expect(f.propietario).toBe('Juan Pérez Soto');
    expect(f.ubicacion).toBe('Km 12 Carretera Panamericana Sur, Sector Los Olivos, Subtanjalla, Ica, Ica');
    expect(f.sistema).toBe('UTM WGS84 - zona 18S');
    expect(f.profesional).toBe('Ing. Ana Torres Ríos - CIP 123456');
    expect(f.etiquetaEscala).toBe('ESCALA (A3):');
  });

  it('lo que falta dice "No consta", nunca queda en blanco', () => {
    const f = filasMembretePredio({});
    expect(f.predio).toBe('No consta');
    expect(f.propietario).toBe('No consta');
    expect(f.ubicacion).toBe('No consta');
    expect(f.profesional).toBe('No consta');
  });

  it('un profesional con solo nombre o solo colegiatura se muestra igual', () => {
    expect(filasMembretePredio({ profesional: { nombre: 'Ing. X' } }).profesional).toBe('Ing. X');
    expect(filasMembretePredio({ profesional: { colegiatura: 'CIP 9' } }).profesional).toBe('CIP 9');
  });

  it('ignora espacios sobrantes y valores vacíos', () => {
    const f = filasMembretePredio({ distrito: '  Ica ', provincia: '', departamento: ' Ica', propietario: '   ' });
    expect(f.ubicacion).toBe('Ica, Ica');
    expect(f.propietario).toBe('No consta');
  });

  it('sin denominación usa el sector; la zona UTM por defecto es 18', () => {
    expect(filasMembretePredio({ sector: 'Sector X' }).predio).toBe('Sector X');
    expect(filasMembretePredio({ zonaUTM: 17 }).sistema).toBe('UTM WGS84 - zona 17S');
  });
});

describe('rotuloPredioEnPlano', () => {
  it('es la denominación en mayúsculas, o "PREDIO"; nunca "LOTE n" ni "MATRIZ"', () => {
    expect(rotuloPredioEnPlano('Parcela 05')).toBe('PARCELA 05');
    expect(rotuloPredioEnPlano('')).toBe('PREDIO');
    expect(rotuloPredioEnPlano(undefined)).toBe('PREDIO');
  });
});
