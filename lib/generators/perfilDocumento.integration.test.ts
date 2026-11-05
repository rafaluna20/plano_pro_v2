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

async function textosDe(clave: string, ub: any, perfil?: string, extra: { config?: any; crudo?: boolean } = {}): Promise<string[]> {
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
    config: { incluirMemoriaDescriptiva: true, incluirPlanoPerimetrico: true, incluirPlanoUbicacion: true, logoUrl: 'http://127.0.0.1:9/sin-logo.png', ...(perfil ? { perfil } : {}), ...(extra.config ?? {}) },
  };
  await new PlanoGenerator(request).generate();
  if (extra.crudo) return [...capturados.textos];
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

  it('un proyecto enviado por el usuario se imprime, y no se cuela nada de Terra Lima', async () => {
    const ub = { departamento: 'Ica', provincia: 'Ica', distrito: 'Subtanjalla', urbanizacion: 'Saneamiento físico legal' };
    const textos = await textosDe('rect', ub, 'PREDIO');
    expect(textos).toContain('PROYECTO:');
    expect(textos).toContain('Saneamiento físico legal');
    expect(textos.filter((t) => /TERRA|Habilitaci/i.test(t))).toEqual([]);
  }, 60000);

  it('el texto de generalidades habla del predio, no del proyecto inmobiliario', async () => {
    const texto = (await textosDe('rect', undefined, 'PREDIO')).join(' ');
    expect(texto).toContain('describir técnicamente el predio');
  }, 60000);
});

describe('membrete del plano perimétrico con el perfil PREDIO', () => {
  const UB = { departamento: 'Ica', provincia: 'Ica', distrito: 'Subtanjalla', urbanizacion: 'Saneamiento físico legal', direccion: 'Km 12 Panamericana Sur' };
  const PROF = { profesional: { nombre: 'Ing. Ana Torres Ríos', colegiatura: 'CIP 123456' } };

  it('imprime los campos nuevos: ubicación completa, sistema de coordenadas, profesional y firma', async () => {
    const t = await textosDe('rect', UB, 'PREDIO', { config: PROF, crudo: true });
    for (const esperado of ['PREDIO:', 'PROPIETARIO:', 'UBICACIÓN:', 'SISTEMA DE COORDENADAS:', 'PROFESIONAL RESPONSABLE:', 'ESCALA (A3):']) {
      expect(t, esperado).toContain(esperado);
    }
    // La ubicación larga puede ocupar dos líneas: se comprueba el contenido, no el corte.
    const i = t.indexOf('UBICACIÓN:');
    const ubicacion = t.slice(i + 1, i + 3).join(' ');
    for (const parte of ['Km 12 Panamericana Sur', 'Subtanjalla']) expect(ubicacion).toContain(parte);
    expect(ubicacion).not.toContain('Saneamiento'); // el proyecto tiene su propia fila
    expect(t).toContain('UTM WGS84 - zona 18S');
    expect(t).toContain('Ing. Ana Torres Ríos - CIP 123456');
    // Sin recuadro de firma y sello: ocupaba demasiado espacio en el membrete.
    expect(t).not.toContain('FIRMA Y SELLO');
    expect(t).toContain('Titular de Prueba SAC');
  }, 60000);

  it('la fecha sale dd/mm/aaaa (día primero), no el formato de EE. UU.', async () => {
    const t = await textosDe('rect', UB, 'PREDIO', { config: PROF, crudo: true });
    const hoy = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' })
      .formatToParts(new Date()).reduce((a: any, p) => ({ ...a, [p.type]: p.value }), {});
    expect(t).toContain(`${hoy.day}/${hoy.month}/${hoy.year}`);
  }, 60000);

  it('sin profesional la fila queda en blanco (se firma a mano), sin "No consta"', async () => {
    const t = await textosDe('rect', UB, 'PREDIO', { crudo: true });
    const i = t.indexOf('PROFESIONAL RESPONSABLE:');
    expect(i).toBeGreaterThan(-1);
    expect((t[i + 1] ?? '').trim()).not.toBe('No consta');
    expect((t[i + 1] ?? '').trim()).toBe('');
  }, 60000);

  it('quita lo de relleno: "EMPRESA / ING.", "Formato de impresión", "MATRIZ" y "LOTE n"', async () => {
    const t = await textosDe('rect', undefined, 'PREDIO', { config: PROF, crudo: true });
    expect(t.filter((x) => /EMPRESA \/ ING|Formato de impresi|MATRIZ/i.test(x) || /^LOTE\s/.test(x))).toEqual([]);
    expect(t).toContain('PREDIO RECT'); // rótulo dentro del dibujo: la denominación del predio
  }, 60000);

  it('las filas van en el orden pedido: PROYECTO, PROPIETARIO, PREDIO, UBICACIÓN, ÁREA/PERÍMETRO, ESCALA/FECHA/SISTEMA, PROFESIONAL', async () => {
    const t = await textosDe('rect', UB, 'PREDIO', { config: PROF, crudo: true });
    const ordenEsperado = ['PROYECTO:', 'PROPIETARIO:', 'PREDIO:', 'UBICACIÓN:', 'ÁREA:', 'PERÍMETRO:', 'ESCALA (A3):', 'FECHA:', 'SISTEMA DE COORDENADAS:', 'PROFESIONAL RESPONSABLE:'];
    let desde = t.indexOf('PROYECTO:');
    expect(desde).toBeGreaterThan(-1);
    for (const etiqueta of ordenEsperado) {
      const i = t.indexOf(etiqueta, desde);
      expect(i, `falta "${etiqueta}" después del anterior`).toBeGreaterThanOrEqual(desde);
      desde = i;
    }
    expect(t[t.indexOf('PROYECTO:') + 1]).toBe('Saneamiento físico legal');
  }, 60000);

  it('una dirección larga real se reparte en hasta 3 líneas y NO se corta con "..."', async () => {
    const larga = 'lote denominado villa sur 2,ubicado entre el km55 ykm56 de la via autopista panamerica del sur,ingreso hacia la playa';
    const t = await textosDe('rect', { departamento: 'Lima', provincia: 'Lima', distrito: 'Pucusana', direccion: larga }, 'PREDIO', { config: PROF, crudo: true });
    const i = t.indexOf('UBICACIÓN:');
    const lineas = t.slice(i + 1, i + 4);
    expect(lineas.some((l) => l.endsWith('...'))).toBe(false);
    const unido = lineas.join(' ');
    for (const parte of ['villa sur 2', 'km55', 'autopista', 'ingreso hacia la playa', 'Pucusana']) expect(unido).toContain(parte);
  }, 60000);

  it('el rótulo del dibujo lleva el nombre del predio completo, aunque sea largo (no "PREDIO" genérico)', async () => {
    const t = await textosDe('rect', undefined, 'PREDIO', { config: PROF, crudo: true });
    expect(t).toContain('PREDIO RECT');
    expect(t.filter((x) => x === 'PREDIO')).toEqual([]);
  }, 60000);

  it('el membrete de habilitación urbana NO cambia: sigue con sus textos de siempre', async () => {
    const t = await textosDe('rect', UB, undefined, { crudo: true });
    expect(t).toContain('EMPRESA / ING.');
    expect(t.some((x) => /^Formato de impresi/.test(x))).toBe(true);
    expect(t).not.toContain('FIRMA Y SELLO');
    expect(t).not.toContain('PROFESIONAL RESPONSABLE:');
  }, 60000);
});
