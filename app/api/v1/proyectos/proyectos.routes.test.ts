import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Base de datos falsa en memoria (misma semántica de filtros por userId que usan las rutas) ---
type Fila = { id: string; userId: string; nombre: string; datos: any; resumen: any; createdAt: Date; updatedAt: Date };
let filas: Fila[] = [];
let plantillas = new Map<string, any>();
let errorForzado: { code: string } | null = null;
let n = 0;

// Prisma solo devuelve los campos de `select`; la base falsa hace lo mismo.
const sel = (fila: any, select?: Record<string, boolean>) =>
  !fila || !select ? fila : Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, fila[k]]));

const falla = () => {
  if (errorForzado) throw Object.assign(new Error('bd'), errorForzado);
};

vi.mock('@/lib/db/client', () => ({
  prisma: {
    proyecto: {
      findMany: async ({ where, select }: any) => (falla(), filas.filter((f) => f.userId === where.userId).map((f) => sel(f, select))),
      count: async ({ where }: any) => (falla(), filas.filter((f) => f.userId === where.userId).length),
      create: async ({ data, select }: any) => {
        falla();
        const f = { id: `p${++n}`, createdAt: new Date(), updatedAt: new Date(), resumen: null, ...data };
        filas.push(f);
        return sel(f, select);
      },
      findFirst: async ({ where, select }: any) => (falla(), sel(filas.find((f) => f.id === where.id && f.userId === where.userId) ?? null, select)),
      findUnique: async ({ where, select }: any) => (falla(), sel(filas.find((f) => f.id === where.id) ?? null, select)),
      updateMany: async ({ where, data }: any) => {
        falla();
        const hit = filas.filter((f) => f.id === where.id && f.userId === where.userId);
        hit.forEach((f) => Object.assign(f, data, { updatedAt: new Date() }));
        return { count: hit.length };
      },
      deleteMany: async ({ where }: any) => {
        falla();
        const antes = filas.length;
        filas = filas.filter((f) => !(f.id === where.id && f.userId === where.userId));
        return { count: antes - filas.length };
      },
    },
    plantillaDatos: {
      findUnique: async ({ where }: any) => (falla(), plantillas.has(where.userId) ? { datos: plantillas.get(where.userId) } : null),
      upsert: async ({ where, create }: any) => (falla(), plantillas.set(where.userId, create.datos), {}),
    },
  },
}));

// El token de la prueba es directamente el id del usuario ("tok-ana" -> "ana").
vi.mock('@/lib/auth/jwt', () => ({
  extractTokenFromHeader: (h: string | null) => (h ? h.replace('Bearer ', '') : null),
  verifyToken: (t: string) => {
    if (!t.startsWith('tok-')) throw new Error('Token inválido');
    return { userId: t.slice(4), email: 'x@y.z' };
  },
}));

import { GET as listar, POST as crear } from './route';
import { GET as abrir, PUT as guardar, DELETE as eliminar } from './[id]/route';
import { POST as duplicar } from './[id]/duplicar/route';
import { GET as leerPlantilla, PUT as ponerPlantilla } from '../plantilla-datos/route';

const req = (url: string, user: string | null, metodo = 'GET', cuerpo?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method: metodo,
    headers: { ...(user ? { authorization: `Bearer tok-${user}` } : {}), 'content-type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const proyecto = (nombre = 'Villa Sur 2', data: any = { loteId: 'VS2', propietario: 'Navarro', ubicacionLote: { distrito: 'Chilca' }, vertices: [1, 2, 3], contexto: { vecinos: [1] } }) =>
  ({ nombre, datos: { version: 1, data } });
const json = async (r: Response) => r.json();

beforeEach(() => {
  filas = [];
  plantillas = new Map();
  errorForzado = null;
  n = 0;
});

describe('autenticación', () => {
  it('sin token o con token inválido: 401 en todas las rutas', async () => {
    for (const r of [
      await listar(req('/api/v1/proyectos', null)),
      await crear(req('/api/v1/proyectos', null, 'POST', proyecto())),
      await abrir(req('/api/v1/proyectos/p1', null), ctx('p1')),
      await guardar(req('/api/v1/proyectos/p1', null, 'PUT', proyecto()), ctx('p1')),
      await eliminar(req('/api/v1/proyectos/p1', null, 'DELETE'), ctx('p1')),
      await duplicar(req('/api/v1/proyectos/p1/duplicar', null, 'POST'), ctx('p1')),
      await leerPlantilla(req('/api/v1/plantilla-datos', null)),
      await listar(new NextRequest('http://localhost/api/v1/proyectos', { headers: { authorization: 'Bearer basura' } })),
    ]) {
      expect(r.status).toBe(401);
    }
  });
});

describe('crear, listar y abrir', () => {
  it('guarda un proyecto, lo lista con su resumen (sin el JSON grande) y lo abre completo', async () => {
    const c = await crear(req('/api/v1/proyectos', 'ana', 'POST', proyecto()));
    expect(c.status).toBe(201);
    const id = (await json(c)).data.id;

    const lista = (await json(await listar(req('/api/v1/proyectos', 'ana')))).data.proyectos;
    expect(lista).toHaveLength(1);
    expect(lista[0].resumen).toEqual({ loteId: 'VS2', propietario: 'Navarro', distrito: 'Chilca', vertices: 3, vecinos: 1 });
    expect(lista[0].datos).toBeUndefined();

    const abierto = (await json(await abrir(req(`/api/v1/proyectos/${id}`, 'ana'), ctx(id)))).data;
    expect(abierto.nombre).toBe('Villa Sur 2');
    expect(abierto.datos.data.loteId).toBe('VS2');
  });

  it('actualiza un proyecto propio', async () => {
    const id = (await json(await crear(req('/api/v1/proyectos', 'ana', 'POST', proyecto())))).data.id;
    const r = await guardar(req(`/api/v1/proyectos/${id}`, 'ana', 'PUT', proyecto('Otro nombre', { loteId: 'NUEVO' })), ctx(id));
    expect(r.status).toBe(200);
    const a = (await json(await abrir(req(`/api/v1/proyectos/${id}`, 'ana'), ctx(id)))).data;
    expect(a.nombre).toBe('Otro nombre');
    expect(a.datos.data.loteId).toBe('NUEVO');
  });
});

describe('cada usuario ve solo lo suyo', () => {
  it('otro usuario no lo lista, ni abre, ni modifica, ni elimina, ni duplica', async () => {
    const id = (await json(await crear(req('/api/v1/proyectos', 'ana', 'POST', proyecto())))).data.id;

    expect((await json(await listar(req('/api/v1/proyectos', 'beto')))).data.proyectos).toEqual([]);
    expect((await abrir(req(`/api/v1/proyectos/${id}`, 'beto'), ctx(id))).status).toBe(404);
    expect((await guardar(req(`/api/v1/proyectos/${id}`, 'beto', 'PUT', proyecto('Robado')), ctx(id))).status).toBe(404);
    expect((await duplicar(req(`/api/v1/proyectos/${id}/duplicar`, 'beto', 'POST'), ctx(id))).status).toBe(404);
    expect((await eliminar(req(`/api/v1/proyectos/${id}`, 'beto', 'DELETE'), ctx(id))).status).toBe(404);

    // y el de Ana sigue intacto
    const a = (await json(await abrir(req(`/api/v1/proyectos/${id}`, 'ana'), ctx(id)))).data;
    expect(a.nombre).toBe('Villa Sur 2');
  });
});

describe('eliminar y duplicar', () => {
  it('elimina un proyecto propio', async () => {
    const id = (await json(await crear(req('/api/v1/proyectos', 'ana', 'POST', proyecto())))).data.id;
    expect((await eliminar(req(`/api/v1/proyectos/${id}`, 'ana', 'DELETE'), ctx(id))).status).toBe(200);
    expect((await abrir(req(`/api/v1/proyectos/${id}`, 'ana'), ctx(id))).status).toBe(404);
  });

  it('duplica con el sufijo "(copia)" y los mismos datos; el nombre no pasa de 120 caracteres', async () => {
    const id = (await json(await crear(req('/api/v1/proyectos', 'ana', 'POST', proyecto('x'.repeat(120)))))).data.id;
    const r = await duplicar(req(`/api/v1/proyectos/${id}/duplicar`, 'ana', 'POST'), ctx(id));
    expect(r.status).toBe(201);
    const copia = (await json(r)).data;
    expect(copia.nombre.endsWith(' (copia)')).toBe(true);
    expect(copia.nombre.length).toBe(120);
    expect(copia.id).not.toBe(id);
    const a = (await json(await abrir(req(`/api/v1/proyectos/${copia.id}`, 'ana'), ctx(copia.id)))).data;
    expect(a.datos.data.loteId).toBe('VS2');
  });
});

describe('validación', () => {
  it('nombre vacío o demasiado largo: 400', async () => {
    expect((await crear(req('/api/v1/proyectos', 'ana', 'POST', proyecto('   ')))).status).toBe(400);
    expect((await crear(req('/api/v1/proyectos', 'ana', 'POST', proyecto('x'.repeat(121))))).status).toBe(400);
  });

  it('datos que no son un proyecto: 400', async () => {
    expect((await crear(req('/api/v1/proyectos', 'ana', 'POST', { nombre: 'a', datos: 'texto' }))).status).toBe(400);
    expect((await crear(req('/api/v1/proyectos', 'ana', 'POST', { nombre: 'a', datos: { version: 1 } }))).status).toBe(400);
    expect((await crear(req('/api/v1/proyectos', 'ana', 'POST', { nombre: 'a' }))).status).toBe(400);
  });

  it('un proyecto de más de 4 MB: 413 con mensaje claro', async () => {
    const grande = proyecto('Enorme', { relleno: 'x'.repeat(4_100_000) });
    const r = await crear(req('/api/v1/proyectos', 'ana', 'POST', grande));
    expect(r.status).toBe(413);
    expect((await json(r)).error.code).toBe('PROYECTO_MUY_GRANDE');
    expect(filas).toHaveLength(0);
  });

  it('tope de 300 proyectos por usuario', async () => {
    for (let i = 0; i < 300; i++) filas.push({ id: `x${i}`, userId: 'ana', nombre: 'n', datos: {}, resumen: null, createdAt: new Date(), updatedAt: new Date() });
    const r = await crear(req('/api/v1/proyectos', 'ana', 'POST', proyecto()));
    expect(r.status).toBe(400);
    expect((await json(r)).error.code).toBe('LIMITE_PROYECTOS');
    // otro usuario no se ve afectado
    expect((await crear(req('/api/v1/proyectos', 'beto', 'POST', proyecto()))).status).toBe(201);
  });
});

describe('base de datos sin migrar', () => {
  it('si la tabla no existe (P2021) responde 503 explicando qué falta, no un 500 genérico', async () => {
    errorForzado = { code: 'P2021' };
    const r = await listar(req('/api/v1/proyectos', 'ana'));
    expect(r.status).toBe(503);
    expect((await json(r)).error.code).toBe('TABLA_NO_CREADA');
  });

  it('usuario inexistente (P2003): 401 para que vuelva a iniciar sesión', async () => {
    errorForzado = { code: 'P2003' };
    expect((await crear(req('/api/v1/proyectos', 'ana', 'POST', proyecto()))).status).toBe(401);
  });

  it('otro error de BD: 500 sin filtrar detalles internos', async () => {
    errorForzado = { code: 'P9999' };
    const r = await listar(req('/api/v1/proyectos', 'ana'));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await json(r))).not.toMatch(/P9999|bd/);
  });
});

describe('datos frecuentes', () => {
  it('sin guardar devuelve null; guardados se leen; cada usuario tiene los suyos', async () => {
    expect((await json(await leerPlantilla(req('/api/v1/plantilla-datos', 'ana')))).data.datos).toBeNull();
    const datos = { profesional: 'Ing. Ana Torres', registro: 'CIP 123456', distrito: 'Chilca' };
    expect((await ponerPlantilla(req('/api/v1/plantilla-datos', 'ana', 'PUT', { datos }))).status).toBe(200);
    expect((await json(await leerPlantilla(req('/api/v1/plantilla-datos', 'ana')))).data.datos).toEqual(datos);
    expect((await json(await leerPlantilla(req('/api/v1/plantilla-datos', 'beto')))).data.datos).toBeNull();
  });

  it('rechaza campos desconocidos y textos demasiado largos', async () => {
    expect((await ponerPlantilla(req('/api/v1/plantilla-datos', 'ana', 'PUT', { datos: { hack: 'x' } }))).status).toBe(400);
    expect((await ponerPlantilla(req('/api/v1/plantilla-datos', 'ana', 'PUT', { datos: { profesional: 'x'.repeat(201) } }))).status).toBe(400);
  });
});
