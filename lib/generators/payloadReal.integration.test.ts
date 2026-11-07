/**
 * CONTRATO mapa_renasur → plan_pro con payloads REALES (P9, revisión 2026-11-07).
 * Los fixtures son lo que `mapa_renasur` armó de verdad desde un Odoo de ensayo con los datos de producción (recortados a 18 elementos de
 * contexto; el original pesa 1.6 MB). Comprueba que (1) el esquema los acepta, (2) el generador produce los tres documentos y (3) lo que
 * se imprime lleva el NOMBRE DEL PROYECTO y la etiqueta de la parte («124A»), no un «TERRA LIMA» fijo ni el sufijo pegado («1241»).
 */
import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const capturados = vi.hoisted(() => ({ textos: [] as string[] }));
vi.mock('jspdf', async (importOriginal) => {
  const mod: any = await importOriginal();
  const Real = mod.jsPDF;
  class Espia extends Real {
    constructor(...args: any[]) {
      super(...args);
      const original = (this as any).text;
      (this as any).text = (t: any, ...resto: any[]) => {
        (Array.isArray(t) ? t : [t]).forEach((x) => capturados.textos.push(String(x)));
        return original.call(this, t, ...resto);
      };
    }
  }
  return { ...mod, jsPDF: Espia, default: Espia };
});

import { generarPlanosSchema } from '@/lib/validators/apiSchemas';
import { PlanoGenerator } from './PlanoGenerator';

const leer = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', n), 'utf8'));

async function textosDe(payload: any): Promise<string[]> {
  capturados.textos.length = 0;
  const v = generarPlanosSchema.safeParse({ ...payload, config: { ...(payload.config ?? {}), logoUrl: 'http://127.0.0.1:9/sin-logo.png' } });
  expect(v.success, v.success ? '' : JSON.stringify((v as any).error.format()).slice(0, 400)).toBe(true);
  await new PlanoGenerator((v as any).data).generate();
  return [...capturados.textos];
}

describe('payload real de mapa_renasur → generador de plan_pro', () => {
  it('lote partido (124A): imprime «124A», el proyecto del payload y nada pegado como «1241»', async () => {
    const p = leer('payload_real_parte_124A.json');
    expect(p.lote.numeroLote).toBe('124A');
    expect(p.lote.proyectoNombre).toBe('Terra Lima');
    const t = await textosDe(p);
    const todo = t.join(' | ');
    expect(t).toContain('TERRA LIMA');            // la marca sale del proyecto del payload
    expect(todo).toContain('124A');
    expect(t).not.toContain('1241');
  }, 120000);

  it('lote entero: sigue saliendo como siempre (número tal cual)', async () => {
    const p = leer('payload_real_entero_92.json');
    const t = await textosDe(p);
    expect(t).toContain('TERRA LIMA');
    expect(t).toContain('92');
  }, 120000);

  it('con OTRO proyecto en el payload, el documento no dice Terra Lima', async () => {
    const p = leer('payload_real_entero_92.json');
    p.lote.proyectoNombre = 'Parque Sur';
    p.lote.ubicacion = { ...p.lote.ubicacion, urbanizacion: 'Parque Sur' };
    const t = await textosDe(p);
    expect(t.filter((x) => /TERRA/i.test(x))).toEqual([]);
    expect(t).toContain('PARQUE SUR');
  }, 120000);
});
