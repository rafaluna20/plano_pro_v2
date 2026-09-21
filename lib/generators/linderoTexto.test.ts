import { describe, it, expect } from 'vitest';
import { fraseColindancia, sujetoColindante, esTipoVia } from './linderoTexto';

describe('fraseColindancia', () => {
  // Caso real reportado (E01MZR015P): el documento imprimía el código interno
  // de la capa, con guion bajo, en una memoria descriptiva legal.
  it('imprime un nombre legible para el aporte de recreación, sin el código interno', () => {
    const frase = fraseColindancia({ tipo: 'aporte_recreacion', nombre: 'Aporte Recreación Pública 05' });
    expect(frase).toBe('Colinda con el aporte para recreación pública "Aporte Recreación Pública 05"');
    expect(frase).not.toContain('_');
  });

  it('la calle sigue redactándose sin artículo, tal cual llega el tipo', () => {
    expect(fraseColindancia({ tipo: 'calle', nombre: 'calle 12' })).toBe('Colinda con calle "calle 12"');
    expect(fraseColindancia({ tipo: 'Calle', nombre: 'Calle' })).toBe('Colinda con Calle "Calle"');
    expect(fraseColindancia({ tipo: 'av', nombre: 'Avenida E' })).toBe('Colinda con av "Avenida E"');
  });

  it('el lote sigue igual que antes, con su propietario si lo hay', () => {
    expect(fraseColindancia({ tipo: 'lote', nombre: 'etapa 1 mz R lote 16 A=120m2' })).toBe('Colinda con el lote "etapa 1 mz R lote 16 A=120m2"');
    expect(fraseColindancia({ tipo: 'lote', nombre: 'Lote 5', propietario: 'Juan Pérez' })).toBe('Colinda con el lote "Lote 5", propiedad de Juan Pérez');
  });

  it('traduce las demás capas conocidas con su artículo', () => {
    expect(sujetoColindante('jardin')).toBe('el jardín');
    expect(sujetoColindante('area_verde')).toBe('el área verde');
    expect(sujetoColindante('aporte_educacion')).toBe('el aporte para educación');
    expect(sujetoColindante('aporte_otros')).toBe('el aporte para otros fines');
    expect(sujetoColindante('veredas')).toBe('la vereda');
    expect(sujetoColindante('agua')).toBe('el cuerpo de agua');
  });

  it('una capa nueva creada en Odoo (no está en la tabla) igual se imprime sin guiones bajos', () => {
    const frase = fraseColindancia({ tipo: 'zona_reservada', nombre: 'ZR-1' });
    expect(frase).toBe('Colinda con el zona reservada "ZR-1"');
    expect(frase).not.toContain('_');
  });

  it('no distingue mayúsculas en el tipo y tolera datos faltantes', () => {
    expect(sujetoColindante('APORTE_RECREACION')).toBe('el aporte para recreación pública');
    expect(fraseColindancia({ tipo: undefined, nombre: undefined })).toBe('Colinda con el elemento colindante "---"');
  });
});

describe('esTipoVia', () => {
  it('reconoce calle/via/av en cualquier mayúscula y nada más', () => {
    expect(esTipoVia('Calle')).toBe(true);
    expect(esTipoVia(' VIA ')).toBe(true);
    expect(esTipoVia('jardin')).toBe(false);
    expect(esTipoVia(undefined)).toBe(false);
  });
});
