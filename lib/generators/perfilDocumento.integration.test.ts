/**
 * Prueba de integración de los textos que imprimen los generadores (memoria
 * descriptiva, plano de ubicación y copia del perimétrico), con y sin el perfil
 * de documento.
 *
 * 1) PERFIL POR DEFECTO (el flujo de mapa_renasur): los textos deben ser
 *    EXACTAMENTE los de siempre. Se compara contra un archivo de referencia
 *    (golden) grabado con el código anterior al perfil. Para regrabarlo a
 *    propósito: UPDATE_GOLDEN=1 npx vitest run lib/generators/perfilDocumento
 * 2) PERFIL "PREDIO": sin textos de habilitación urbana ("TERRA LIMA",
 *    "Habilitación Urbana", "Desarrollo Inmobiliario", "terreno urbano", Mz./Lote
 *    inventados) y con "No consta" para lo que falte, nunca en blanco.
 */
import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const capturados = vi.hoisted(() => ({ textos: [] as string[] }));

// jsPDF construye sus métodos dentro del constructor, así que no se pueden espiar
// desde fuera: se envuelve el constructor y se intercepta `text` en cada documento.
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

import { PlanoGenerator } from './PlanoGenerator';

const GOLDEN = path.join(__dirname, '__golden__', 'textos_habilitacion_urbana.json');

// Fixtures portátiles (UTM 18S, Pucusana): un lote rectangular y uno de 5 vértices.
const LOTES: Record<string, { vertices: [number, number][]; manzana: string; numero: string; etapa: string }> = {
  rect: { vertices: [[308778.36, 8622974.29], [308788.36, 8622974.29], [308788.36, 8622954.29], [308778.36, 8622954.29]], manzana: 'L', numero: '006', etapa: 'Etapa 3' },
  pent: { vertices: [[308800, 8622900], [308812, 8622900], [308816, 8622910], [308806, 8622918], [308798, 8622910]], manzana: 'M', numero: '012', etapa: '' },
};

const UBICACIONES: Record<string, any> = {
  completa: { departamento: 'Lima', provincia: 'Lima', distrito: 'Pucusana', urbanizacion: 'Terra Lima', direccion: 'Mz. L Lt. 6' },
  sin_direccion: { departamento: 'Lima', provincia: 'Lima', distrito: 'Pucusana' },
  sin_ubicacion: undefined,
};

function medidas(c: [number, number][]) {
  let s = 0, per = 0;
  const lados: number[] = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length];
    s += a[0] * b[1] - b[0] * a[1];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    per += d; lados.push(d);
  }
  return { area: Math.abs(s) / 2, perimetro: per, frente: Math.max(...lados) };
}

async function textosDe(clave: string, ub: any, perfil?: string): Promise<string[]> {
  const f = LOTES[clave];
  const m = medidas(f.vertices);
  capturados.textos.length = 0;
  const request: any = {
    vertices: f.vertices,
    dimensiones: { frente: m.frente, fondo: 0, ladoDerecho: 0, ladoIzquierdo: 0, area: m.area, perimetro: m.perimetro },
    // Un predio general no tiene manzana, lote ni etapa de proyecto.
    lote: perfil === 'PREDIO'
      ? { codigo: `PREDIO-${clave.toUpperCase()}`, nombre: `Predio ${clave}`, manzana: '', etapa: '', numeroLote: '', estado: 'libre', ...(ub ? { ubicacion: ub } : {}) }
      : { codigo: `E03MZ${f.manzana}${f.numero}P`, nombre: `Lote ${f.numero}`, manzana: f.manzana, etapa: f.etapa, numeroLote: f.numero, estado: 'libre', ...(ub ? { ubicacion: ub } : {}) },
    colindancias: [{ lado: 'norte', tipo: 'lote', nombre: 'Lote 01', longitud: 10 }, { lado: 'sur', tipo: 'calle', nombre: 'Calle 2', longitud: 10 }],
    propietario: { nombre: 'Titular de Prueba SAC', ruc: '20123456789' },
    // Logo inalcanzable: sin red; el generador cae a su texto alternativo.
    config: { incluirMemoriaDescriptiva: true, incluirPlanoPerimetrico: true, incluirPlanoUbicacion: true, logoUrl: 'http://127.0.0.1:9/sin-logo.png', ...(perfil ? { perfil } : {}) },
  };
  await new PlanoGenerator(request).generate();
  // Cambian en cada corrida: la fecha de hoy (en cualquiera de sus formatos) y el código de documento (DOC-<código>-<marca de tiempo>).
  return capturados.textos.filter(
    (t) => !/\d{1,2} de [a-záéíóú]+ de \d{4}/i.test(t) && !/\d{1,2}\/\d{1,2}\/\d{4}/.test(t) && !/^DOC-.+-[A-Z0-9]{6,}$/.test(t),
  );
}

describe('textos con el perfil por defecto (flujo de mapa_renasur)', () => {
  it('son idénticos a los de siempre (golden)', async () => {
    const actual: Record<string, string[]> = {};
    for (const clave of Object.keys(LOTES)) {
      for (const [nombre, ub] of Object.entries(UBICACIONES)) {
        actual[`${clave}|${nombre}`] = await textosDe(clave, ub);
      }
    }
    if (process.env.DUMP_ACTUAL) fs.writeFileSync(process.env.DUMP_ACTUAL, JSON.stringify(actual, null, 1));
    if (process.env.UPDATE_GOLDEN === '1') {
      fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
      fs.writeFileSync(GOLDEN, JSON.stringify(actual, null, 1));
      console.log('golden grabado en', GOLDEN);
      return;
    }
    const esperado = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
    expect(actual).toEqual(esperado);
  }, 120000);

  it('el golden contiene los textos de habilitación urbana que se quieren conservar', () => {
    const texto = fs.readFileSync(GOLDEN, 'utf8');
    expect(texto).toContain('TERRA LIMA');
    expect(texto).toContain('Desarrollo Inmobiliario');
    expect(texto).toContain('parte del proyecto inmobiliario');
  });
});

describe('textos con el perfil PREDIO (predio general)', () => {
  const PROHIBIDO = /TERRA|Habilitaci|Desarrollo Inmobiliario|proyecto inmobiliario|terreno urbano/i;

  for (const clave of Object.keys(LOTES)) {
    it(`${clave}: sin ubicación ni dirección no imprime nada de habilitación urbana y dice "No consta"`, async () => {
      for (const variante of ['sin_direccion', 'sin_ubicacion']) {
        const textos = await textosDe(clave, UBICACIONES[variante], 'PREDIO');
        const prohibidos = textos.filter((t) => PROHIBIDO.test(t));
        expect(prohibidos, `${clave}|${variante}`).toEqual([]);
        // No se inventa una dirección tipo "Mz. L Lote 006"
        expect(textos.some((t) => /^Mz\. /.test(t))).toBe(false);
      }
      const sinUbicacion = await textosDe(clave, undefined, 'PREDIO');
      expect(sinUbicacion).toContain('No consta');
    }, 60000);
  }

  it('declara el sistema de coordenadas y usa la denominación del predio', async () => {
    const textos = await textosDe('rect', UBICACIONES.completa, 'PREDIO');
    expect(textos).toContain('SISTEMA DE COORDENADAS:');
    expect(textos).toContain('UTM WGS84 - zona 18S');
    expect(textos).toContain('DENOMINACIÓN:');
    expect(textos).toContain('Predio rect');
    expect(textos.some((t) => /^PREDIO:/.test(t))).toBe(true);
  }, 60000);

  it('un sector enviado por el usuario se imprime, y no se cuela nada de Terra Lima', async () => {
    const ub = { departamento: 'Ica', provincia: 'Ica', distrito: 'Subtanjalla', urbanizacion: 'Sector Los Olivos' };
    const textos = await textosDe('rect', ub, 'PREDIO');
    expect(textos).toContain('SECTOR / URBANIZACIÓN:');
    expect(textos).toContain('Sector Los Olivos');
    expect(textos.filter((t) => /TERRA|Habilitaci/i.test(t))).toEqual([]);
  }, 60000);

  it('el texto de generalidades habla del predio, no del proyecto inmobiliario', async () => {
    const texto = (await textosDe('rect', undefined, 'PREDIO')).join(' ');
    expect(texto).toContain('describir técnicamente el predio');
  }, 60000);
});
