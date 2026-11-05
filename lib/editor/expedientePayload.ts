/**
 * Arma el payload de POST /api/v1/planos/generar (expediente completo: memoria
 * descriptiva + plano de ubicación + plano perimétrico) a partir de lo que el
 * usuario tiene escrito en el editor web.
 *
 * Es la MISMA ruta que usa mapa_renasur (app/api/planos/generar). Los botones
 * "Exportar PDF" e "Impresión API" del editor usan otros motores que dibujan
 * solo el plano perimétrico; este módulo permite que la web genere el mismo
 * expediente que mapa_renasur.
 *
 * Función pura (sin React ni red) para poder probarla con vitest.
 */

export interface VerticeEntrada {
  id: string;
  x: number;
  y: number;
}

export interface AdyacenteEntrada {
  lote: string;
  propietario: string;
  dimension: number;
}

export interface VecinoEntrada {
  id: string;
  nombre: string;
  codigo?: string;
  estado?: string;
  vertices: VerticeEntrada[];
}

export interface EntradaExpediente {
  loteId: string;
  propietario: string;
  titularDoc: { tipo: 'DNI' | 'RUC' | 'CE' | 'PAS'; numero: string };
  ubicacion: {
    departamento: string;
    provincia: string;
    distrito: string;
    direccion: string;
  };
  proyecto: string;
  vertices: VerticeEntrada[];
  vecinos: VecinoEntrada[];
  adyacentes: Partial<Record<Lado, AdyacenteEntrada>>;
}

export type Lado = 'norte' | 'este' | 'sur' | 'oeste';

export interface PayloadExpediente {
  vertices: [number, number][];
  dimensiones: {
    frente: number;
    fondo: number;
    ladoDerecho: number;
    ladoIzquierdo: number;
    area: number;
    perimetro: number;
  };
  lote: {
    codigo: string;
    nombre: string;
    manzana: string;
    etapa: string;
    numeroLote: string;
    estado: 'libre';
    ubicacion: {
      departamento: string;
      provincia: string;
      distrito: string;
      urbanizacion: string;
      direccion?: string;
    };
  };
  colindancias: {
    lado: Lado;
    tipo: 'lote';
    nombre: string;
    propietario?: string;
    longitud: number;
  }[];
  propietario: { nombre: string; dni?: string; ruc?: string };
  contexto?: {
    elementos: {
      codigo: string;
      vertices: [number, number][];
      estado: string;
      tipo: 'lote';
      texto: string;
    }[];
  };
}

export type ResultadoExpediente =
  | { ok: true; payload: PayloadExpediente; advertencias: string[] }
  | { ok: false; errores: string[] };

const r2 = (n: number) => Math.round(n * 100) / 100;

function distancia(a: VerticeEntrada, b: VerticeEntrada): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function areaPoligono(v: VerticeEntrada[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const j = (i + 1) % v.length;
    s += v[i].x * v[j].y - v[j].x * v[i].y;
  }
  return Math.abs(s) / 2;
}

/**
 * Para un cuadrilátero, asigna a cada arista (vértice i → i+1) el lado
 * cardinal hacia el que "mira", según dónde queda su punto medio respecto al
 * centroide (X = este, Y = norte en UTM). Devuelve null si dos aristas caen en
 * el mismo lado (lote girado ~45°): ahí no hay una asignación confiable.
 */
function ladosPorGeometria(v: VerticeEntrada[]): Lado[] | null {
  const cx = v.reduce((s, p) => s + p.x, 0) / v.length;
  const cy = v.reduce((s, p) => s + p.y, 0) / v.length;
  const lados = v.map((p, i) => {
    const q = v[(i + 1) % v.length];
    const dx = (p.x + q.x) / 2 - cx;
    const dy = (p.y + q.y) / 2 - cy;
    return (Math.abs(dy) >= Math.abs(dx)
      ? dy > 0
        ? 'norte'
        : 'sur'
      : dx > 0
        ? 'este'
        : 'oeste') as Lado;
  });
  return new Set(lados).size === 4 ? lados : null;
}

export function construirPayloadExpediente(
  e: EntradaExpediente,
): ResultadoExpediente {
  const errores: string[] = [];
  const advertencias: string[] = [];
  const v = e.vertices;

  if (v.length < 3) errores.push('Se requieren al menos 3 vértices.');
  const area = v.length >= 3 ? areaPoligono(v) : 0;
  if (v.length >= 3 && area <= 0)
    errores.push('El área del lote es 0: revisa los vértices.');

  const aristas = v.map((p, i) => distancia(p, v[(i + 1) % v.length]));
  const perimetro = aristas.reduce((s, d) => s + d, 0);

  // --- Colindancias (los linderos de la memoria descriptiva) ---
  const colindancias: PayloadExpediente['colindancias'] = [];
  if (v.length === 4) {
    let lados = ladosPorGeometria(v);
    if (!lados) {
      lados = ['norte', 'este', 'sur', 'oeste'];
      advertencias.push(
        'El lote está girado: los lados N/E/S/O se asignaron por el orden de los vértices (A→B = Norte), no por su orientación real. Revisa los linderos.',
      );
    }
    const sinNombre: string[] = [];
    lados.forEach((lado, i) => {
      const ady = e.adyacentes[lado];
      const nombre = (ady?.lote ?? '').trim();
      if (!nombre) {
        sinNombre.push(lado);
        return;
      }
      colindancias.push({
        lado,
        tipo: 'lote',
        nombre,
        ...((ady?.propietario ?? '').trim()
          ? { propietario: ady!.propietario.trim() }
          : {}),
        longitud: r2(aristas[i]),
      });
    });
    if (sinNombre.length)
      errores.push(
        `Falta el colindante de: ${sinNombre.join(', ')} (pestaña General → Colindancias).`,
      );
  } else if (v.length >= 3) {
    advertencias.push(
      `El lote tiene ${v.length} vértices: el editor solo sabe asignar colindantes N/S/E/O a lotes de 4 lados, así que la memoria saldrá sin linderos.`,
    );
  }

  if (errores.length) return { ok: false, errores };

  // --- Dimensiones (solo resumen; el plano se dibuja con los vértices) ---
  let iMax = 0;
  aristas.forEach((d, i) => {
    if (d > aristas[iMax]) iMax = i;
  });
  const frente = aristas[iMax];
  const cuatro = v.length === 4;
  const dimensiones = {
    frente: r2(frente),
    fondo: cuatro ? r2(aristas[(iMax + 2) % 4]) : 0,
    ladoDerecho: cuatro ? r2(aristas[(iMax + 1) % 4]) : 0,
    ladoIzquierdo: cuatro ? r2(aristas[(iMax + 3) % 4]) : 0,
    area: r2(area),
    perimetro: r2(perimetro),
  };

  // --- Identificación del lote ---
  const codigo = e.loteId.trim();
  const manzana = codigo.match(/MZ-?([A-Z0-9]+?)(?:-|LOTE|L\b|\d|$)/i)?.[1] ?? '';
  const numeroLote = codigo.match(/(\d+)\D*$/)?.[1] ?? '';
  if (!manzana || !numeroLote)
    advertencias.push(
      'No pude leer la manzana y/o el número de lote del código; esos campos saldrán en blanco en los documentos.',
    );

  const direccion = e.ubicacion.direccion.trim();
  const doc = e.titularDoc.numero.trim();
  const propietario: PayloadExpediente['propietario'] = {
    nombre: e.propietario.trim(),
    ...(e.titularDoc.tipo === 'DNI' ? { dni: doc } : {}),
    ...(e.titularDoc.tipo === 'RUC' ? { ruc: doc } : {}),
  };
  if (e.titularDoc.tipo === 'CE' || e.titularDoc.tipo === 'PAS')
    advertencias.push(
      `El documento del titular es ${e.titularDoc.tipo}: este servicio solo registra DNI o RUC, así que no se enviará.`,
    );

  const elementos = e.vecinos
    .filter((n) => n.vertices.length >= 3)
    .map((n) => ({
      codigo: n.codigo || n.id,
      vertices: n.vertices.map((p) => [p.x, p.y] as [number, number]),
      estado: n.estado || 'libre',
      tipo: 'lote' as const,
      texto: n.nombre,
    }));

  const payload: PayloadExpediente = {
    vertices: v.map((p) => [p.x, p.y] as [number, number]),
    dimensiones,
    lote: {
      codigo,
      nombre: numeroLote ? `Lote ${numeroLote}` : codigo,
      manzana,
      etapa: '',
      numeroLote,
      estado: 'libre',
      ubicacion: {
        departamento: e.ubicacion.departamento.trim(),
        provincia: e.ubicacion.provincia.trim(),
        distrito: e.ubicacion.distrito.trim(),
        urbanizacion: e.proyecto.trim(),
        ...(direccion ? { direccion } : {}),
      },
    },
    colindancias,
    propietario,
    ...(elementos.length ? { contexto: { elementos } } : {}),
  };

  return { ok: true, payload, advertencias };
}
