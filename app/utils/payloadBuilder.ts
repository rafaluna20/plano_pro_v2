/**
 * payloadBuilder.ts
 * Construye el PlanoPayloadHibrido a partir del estado del formulario.
 * Extraído de page.tsx para poder ser testeado de forma independiente.
 */

import {
  Vertice,
  calcularOrientacion,
  distanciaEntre,
} from "@/app/utils/geometry";

// ─── Tipos locales ────────────────────────────────────────────────────────────
type Lado = "norte" | "sur" | "este" | "oeste";

interface LoteAdyacente {
  id: string;
  estado: string;
  dimension: number;
  lote: string;
  propietario: string;
  vertices: Vertice[];
}

interface LoteVecino {
  id: string;
  nombre: string;
  vertices: Vertice[];
  codigo?: string;
  estado?: string;
}

interface MembreteData {
  proyecto: string;
  plano: string;
  profesional: string;
  registro: string;
  fecha: string;
  lamina: string;
  escala: string;
}

interface UbicacionData {
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
}

export interface LoteData {
  loteId: string;
  propietario: string;
  area: number;
  membrete: MembreteData;
  vertices: Vertice[];
  contexto: { vecinos: LoteVecino[] };
  config: { modoUbicacion: "vectorial" | "satelital" | "imagen" };
  imagenGeneral: string;
  logoUrl: string;
  lotesAdyacentes: Partial<Record<Lado, LoteAdyacente>>;
  ubicacion: UbicacionData;
}

// ─── Builder principal ────────────────────────────────────────────────────────
export function buildHybridPayload(data: LoteData) {
  const loteMatch = data.loteId.match(/\d+/);
  const manzanaMatch = data.loteId.match(/MZ-([A-Z])/i);

  // Linderos con orientación calculada correctamente para CUALQUIER polígono
  const linderos = data.vertices.map((v, i) => {
    const nextIndex = (i + 1) % data.vertices.length;
    const v2 = data.vertices[nextIndex];
    const orientacion = calcularOrientacion(v, v2);
    const dist = distanciaEntre(v, v2);

    // Para polígonos de 4 lados: preferir datos registrales si existen
    let longitudTexto = dist.toFixed(2);
    let colindanciaTexto = `Lado ${i + 1}`;

    if (data.vertices.length === 4) {
      const ladoMap: Record<number, Lado> = {
        0: "norte",
        1: "este",
        2: "sur",
        3: "oeste",
      };
      const lado = ladoMap[i];
      if (lado) {
        const adyacente = data.lotesAdyacentes[lado];
        if (adyacente?.dimension && adyacente.dimension > 0) {
          longitudTexto = adyacente.dimension.toFixed(2);
        }
        if (adyacente?.lote) {
          colindanciaTexto = adyacente.lote;
        }
      }
    }

    return {
      index: i,
      tramo: `V${i + 1} - V${nextIndex + 1}`,
      longitudTexto,
      colindanciaTexto,
      orientacion,
    };
  });

  return {
    meta: {
      solicitudId: `WEB-${Date.now()}`,
      fechaSolicitud: new Date().toISOString(),
      solicitante: data.propietario || "Usuario Web",
    },

    loteObjetivo: {
      type: "Feature" as const,
      properties: {
        identificador: {
          manzana: manzanaMatch ? manzanaMatch[1] : "A",
          lote: loteMatch ? loteMatch[0] : "01",
          urbanizacion: data.membrete.proyecto || "Urbanización",
        },
        comercial: {
          nombreComercial: `Lote ${loteMatch ? loteMatch[0] : data.loteId}`,
        },
        ubicacion: {
          direccion: data.ubicacion.direccion || "Sin dirección",
          distrito: data.ubicacion.distrito || "Lima",
          provincia: data.ubicacion.provincia || "Lima",
          departamento: data.ubicacion.departamento || "Lima",
        },
        titularidad: {
          nombre: data.propietario || "Sin especificar",
          documento: {
            tipo: "DNI" as const,
            numero: "00000000",
          },
        },
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            ...data.vertices.map((v) => [v.x, v.y] as [number, number]),
            [data.vertices[0].x, data.vertices[0].y],
          ],
        ],
      },
    },

    datosRegistrales: {
      areaOficial: data.area,
      perimetroOficial: null,
      linderos,
    },

    contexto: {
      type: "FeatureCollection" as const,
      features: [
        ...data.contexto.vecinos.map((vecino) => ({
          type: "Feature" as const,
          properties: {
            tipo: "lote" as const,
            numeroLote: vecino.nombre.match(/\d+/)?.[0] || vecino.id,
            estado: vecino.estado || "libre",
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                ...vecino.vertices.map((v) => [v.x, v.y] as [number, number]),
                [vecino.vertices[0].x, vecino.vertices[0].y],
              ],
            ],
          },
        })),
        ...Object.entries(data.lotesAdyacentes || {})
          .filter(([, info]) => info && info.vertices && info.vertices.length >= 3)
          .map(([key, info]) => ({
            type: "Feature" as const,
            properties: {
              tipo: "lote" as const,
              numeroLote: info!.lote || key,
              estado: info!.estado || "libre",
            },
            geometry: {
              type: "Polygon" as const,
              coordinates: [
                [
                  ...info!.vertices.map((v) => [v.x, v.y] as [number, number]),
                  [info!.vertices[0].x, info!.vertices[0].y],
                ],
              ],
            },
          })),
      ],
    },

    configImpresion: {
      formatoPapel: "a3" as const,
      orientacion: "landscape" as const,
      incluirNorte: true,
      incluirEscala: true,
      estilos: {
        colorLotePrincipal: "#000000",
        colorVecinos: "#CCCCCC",
      },
      modoUbicacion: data.config.modoUbicacion,
      logoUrl: data.logoUrl || "",
      imagenGeneral: data.imagenGeneral || "",
    },
  };
}
