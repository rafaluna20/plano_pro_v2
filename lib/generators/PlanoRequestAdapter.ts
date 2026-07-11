
import {
    GenerarPlanosRequest,
    UTMCoordinate,
    PlanoConfig
} from '@/types/planos';
import {
    PlanoPayloadHibrido,
    LoteObjetivo,
    ContextoGeoespacial,
    DatosRegistrales,
    Feature,
    Geometry
} from '@/types/PlanosPayload';
import { DEFAULT_UTM_ZONE } from '@/lib/geometry/utmUtils';
import { expandirVerticesConArcos } from '@/lib/geometry/arcoUtils';

// Logo por defecto (Akallpa) para el membrete, si el caller no manda uno
// propio en config.logoUrl. Subido a Vercel Blob (mismo storage que usan
// los PDFs generados) para tener una URL pública permanente.
export const DEFAULT_LOGO_URL = 'https://uaqvcyzkl4dd5hx4.public.blob.vercel-storage.com/branding/logo-akallpa.png';

/**
 * Adaptador para transformar solicitudes legacy (V1) al nuevo formato híbrido (V2).
 * Permite usar el motor V2 sin romper la compatibilidad con el frontend existente.
 */
export class PlanoRequestAdapter {

    static toHybridPayload(request: GenerarPlanosRequest): PlanoPayloadHibrido {
        return {
            meta: {
                solicitudId: 'legacy-' + Date.now(),
                timestamp: new Date().toISOString(),
                crs: 'EPSG:32718', // Asumido por defecto para Perú/Terra Lima (Zona 18S)
                logicaAplicada: 'PRIORIDAD_REGISTRAL_CON_FALLBACK_GEOMETRICO'
            },
            loteObjetivo: this.mapLoteObjetivo(request),
            datosRegistrales: this.mapDatosRegistrales(request),
            contexto: this.mapContexto(request),
            configImpresion: this.mapConfig(request.config)
        };
    }

    private static mapLoteObjetivo(request: GenerarPlanosRequest): LoteObjetivo {
        const { vertices, lote } = request;

        // Asegurar cierre del polígono (GeoJSON requiere primer y último punto iguales)
        const verticesCerrados = [...vertices];
        if (
            verticesCerrados.length > 0 &&
            (verticesCerrados[0][0] !== verticesCerrados[verticesCerrados.length - 1][0] ||
                verticesCerrados[0][1] !== verticesCerrados[verticesCerrados.length - 1][1])
        ) {
            verticesCerrados.push(verticesCerrados[0]);
        }

        // Si el lote tiene lados curvos (request.arcos, ver x_geometry_arcos
        // en Odoo), se reemplazan esos lados por puntos muestreados sobre el
        // arco real ANTES de convertir a GeoJSON — así todo el código de
        // dibujo existente (que solo conecta puntos consecutivos con líneas
        // rectas) dibuja la curva real sin necesitar cambios propios.
        const coordinates = expandirVerticesConArcos(verticesCerrados, request.arcos);

        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [coordinates]
            },
            properties: {
                codigoInterno: lote.codigo,
                identificador: {
                    manzana: lote.manzana,
                    lote: lote.numeroLote,
                    etapa: lote.etapa,
                    urbanizacion: lote.ubicacion?.urbanizacion || lote.nombre
                },
                // Sin defaults a 'Lima': si el payload no trae ubicación
                // administrativa, se debe ver el vacío ('---') en el
                // documento, no una ciudad inventada. PlanoDataProcessor
                // marca requiresReview cuando esto pasa.
                ubicacion: {
                    departamento: lote.ubicacion?.departamento || '---',
                    provincia: lote.ubicacion?.provincia || '---',
                    distrito: lote.ubicacion?.distrito || '---',
                    direccion: lote.ubicacion?.direccion,
                    // A diferencia de departamento/provincia/distrito, un
                    // default numérico aquí SÍ es apropiado: la zona UTM es
                    // un parámetro de proyección, no un dato administrativo
                    // que pueda "inventarse" incorrectamente a simple vista.
                    // 18 es correcto para el 100% del tráfico actual (Lima).
                    zonaUTM: lote.ubicacion?.zonaUTM ?? DEFAULT_UTM_ZONE,
                },
                titularidad: request.propietario ? {
                    nombre: request.propietario.nombre,
                    documento: request.propietario.dni ? { tipo: 'DNI', numero: request.propietario.dni } : undefined
                } : undefined
            }
        };
    }

    private static mapDatosRegistrales(request: GenerarPlanosRequest): DatosRegistrales {
        // En V1, "dimensiones" suelen ser calculadas, no necesariamente "oficiales" registrales.
        // Pero si vienen explícitas, podemos tomarlas como referencia.
        // Para linderos, como no tenemos mapeo directo vértice-colindancia en V1 simple,
        // dejamos que el DataProcessor los calcule geométricamente y detecte colindancias del contexto.
        return {
            areaOficial: request.dimensiones?.area || null,
            perimetroOficial: request.dimensiones?.perimetro || null,
            linderos: null // Se calcularán automáticamente
        };
    }

    private static mapContexto(request: GenerarPlanosRequest): ContextoGeoespacial {
        const features: Feature[] = [];
        const contexto = request.contexto;

        if (contexto) {
            if (contexto.lotesVecinos) {
                contexto.lotesVecinos.forEach(vecino => {
                    if (vecino.vertices && vecino.vertices.length > 0) {
                        // Asegurar cierre
                        const coords = [...vecino.vertices];
                        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                            coords.push(coords[0]);
                        }

                        features.push({
                            type: 'Feature',
                            properties: {
                                tipo: 'lote',
                                numeroLote: vecino.codigo, // Usamos codigo como número si no hay más info
                                estado: vecino.estado as any
                            },
                            geometry: {
                                type: 'Polygon',
                                coordinates: [coords]
                            }
                        });
                    }
                });
            }

            if (contexto.elementos) {
                contexto.elementos.forEach(el => {
                    if (el.vertices && el.vertices.length > 0) {
                        const coords = [...el.vertices];
                        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                            coords.push(coords[0]);
                        }

                        // 'LOTE' es el único valor reservado (lote vecino
                        // común, sin color propio). Cualquier otro string es
                        // un código de capa dinámico (elemento.urbano.capa
                        // en Odoo) que ya viene con su propio color/
                        // mostrarEtiqueta en el payload — no hay un enum
                        // fijo que mantener acá.
                        const esLote = el.tipo === 'LOTE';
                        features.push({
                            type: 'Feature',
                            properties: {
                                tipo: esLote ? 'lote' : (el.tipo || 'lote').toLowerCase(),
                                color: esLote ? undefined : el.color,
                                mostrarEtiqueta: esLote ? undefined : el.mostrarEtiqueta,
                                nombre: el.texto,
                                numeroLote: el.texto, // Etiqueta visible en Plano Perimétrico (renderContext)
                                descripcionAlterna: el.texto
                            },
                            geometry: {
                                type: 'Polygon',
                                coordinates: [coords]
                            }
                        });
                    }
                });
            }
        }

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    private static mapConfig(config?: Partial<PlanoConfig>): any {
        return {
            incluirMemoriaDescriptiva: config?.incluirMemoriaDescriptiva ?? true,
            incluirPlanoPerimetrico: config?.incluirPlanoPerimetrico ?? true,
            incluirPlanoUbicacion: config?.incluirPlanoUbicacion ?? true,
            formatoPapel: config?.formatoPapel || 'A3',
            orientacion: config?.orientacion || 'landscape',
            escala: config?.escala || null,
            logoUrl: config?.logoUrl || DEFAULT_LOGO_URL,
            estilos: {
                mostrarCotas: true,
                mostrarGrilla: true,
                grosorLineaLote: 0.5,
                colorLote: '#000000',
                colorContexto: '#CCCCCC'
            }
        };
    }
}
