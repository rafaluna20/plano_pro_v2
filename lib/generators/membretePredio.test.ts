import { describe, it, expect } from 'vitest';
import { fechaPeru, filasMembretePredio, rotuloPredioEnPlano, MEMBRETE_PREDIO, ALTURA_MEMBRETE_PREDIO_MM } from './membretePredio';

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
    proyecto: 'Saneamiento físico legal',
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
    expect(f.proyecto).toBe('Saneamiento físico legal');
    expect(f.predio).toBe('Fundo La Esperanza - Parcela 05');
    expect(f.propietario).toBe('Juan Pérez Soto');
    expect(f.ubicacion).toBe('Km 12 Carretera Panamericana Sur, Subtanjalla, Ica, Ica');
    expect(f.sistema).toBe('UTM WGS84 - zona 18S');
    expect(f.profesional).toBe('Ing. Ana Torres Ríos - CIP 123456');
    expect(f.etiquetaEscala).toBe('ESCALA (A3):');
  });

  it('lo que falta dice "No consta", nunca queda en blanco', () => {
    const f = filasMembretePredio({});
    expect(f.proyecto).toBe('No consta');
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

  it('un proyecto igual a la denominación es el relleno del adaptador: se trata como ausente', () => {
    const f = filasMembretePredio({ denominacion: 'villa sur 2', proyecto: 'Villa Sur 2' });
    expect(f.proyecto).toBe('No consta');
  });

  it('el proyecto NO se mezcla en la ubicación', () => {
    const f = filasMembretePredio({ denominacion: 'Parcela 5', proyecto: 'Saneamiento físico legal', distrito: 'Ica' });
    expect(f.proyecto).toBe('Saneamiento físico legal');
    expect(f.ubicacion).toBe('Ica');
  });

  it('sin denominación el predio dice "No consta" (el proyecto no lo reemplaza); zona UTM por defecto 18', () => {
    expect(filasMembretePredio({ proyecto: 'Saneamiento físico legal' }).predio).toBe('No consta');
    expect(filasMembretePredio({ zonaUTM: 17 }).sistema).toBe('UTM WGS84 - zona 17S');
  });
});

describe('rotuloPredioEnPlano', () => {
  it('es la denominación en mayúsculas, o "PREDIO"; nunca "LOTE n" ni "MATRIZ"', () => {
    expect(rotuloPredioEnPlano('Parcela 05')).toBe('PARCELA 05');
    expect(rotuloPredioEnPlano('')).toBe('PREDIO');
    expect(rotuloPredioEnPlano(undefined)).toBe('PREDIO');
  });

  it('sin denominación usa el sector (respaldo); solo sin ninguno de los dos dice "PREDIO"', () => {
    expect(rotuloPredioEnPlano(undefined, 'Sector Los Olivos')).toBe('SECTOR LOS OLIVOS');
    expect(rotuloPredioEnPlano('  ', 'Sector X')).toBe('SECTOR X');
    expect(rotuloPredioEnPlano('Villa Sur 2', 'Otro sector')).toBe('VILLA SUR 2');
    expect(rotuloPredioEnPlano(undefined, undefined)).toBe('PREDIO');
  });
});

describe('medidas del membrete del predio', () => {
  it('letras al tamaño original (factor 1) y altura total de 62.5 mm', () => {
    expect(MEMBRETE_PREDIO.FACTOR_FUENTE).toBe(1);
    expect(ALTURA_MEMBRETE_PREDIO_MM).toBe(62.5);
  });
  it('7 filas; la de ubicación (4.ª) es la más alta, porque admite 3 líneas', () => {
    expect(MEMBRETE_PREDIO.FILAS_MM).toHaveLength(7);
    expect(Math.max(...MEMBRETE_PREDIO.FILAS_MM)).toBe(MEMBRETE_PREDIO.FILAS_MM[3]);
    expect(MEMBRETE_PREDIO.MAX_LINEAS_UBICACION).toBe(3);
  });
});
