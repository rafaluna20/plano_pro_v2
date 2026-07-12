/**
 * PlanoDataProcessor.ts - Servicio de Lógica Híbrida para Planos
 * 
 * Este servicio implementa la lógica de "Prioridad Registral con Fallback Geométrico":
 * 1. Valida integridad de datos
 * 2. Usa datos registrales cuando existen
 * 3. Calcula desde geometría cuando no existen
 * 4. Detecta colindancias automáticamente
 * 
 * Stack: Turf.js (análisis geoespacial)
 */

import * as turf from '@turf/turf';
import { calculateInteriorAngles } from '@/lib/geometry/utmUtils';
import type {
  PlanoPayloadHibrido,
  DatosRegistrales,
  LinderoRegistral,
  ContextoGeoespacial,
  LoteObjetivo
} from '@/types/PlanosPayload';

// ============================================================================
// CONSTANTES
// ============================================================================

/** Tolerancia para verificación área/perímetro (2%) */
const TOLERANCE_PERCENTAGE = 0.02;

/** Radio de buffer para detección de colindancias (en metros) */
const BUFFER_DETECTION_RADIUS = 0.1; // 10cm

/** Umbral de diferencia para considerar dos ángulos como la misma dirección */
const ANGLE_THRESHOLD = 15; // grados

// ============================================================================
// TIPOS INTERNOS
// ============================================================================

/**
 * Resultado del procesamiento
 */
export interface DatosProcesados {
  /** Área final (registral o calculada) */
  areaFinal: number;
  
  /** Perímetro final (registral o calculado) */
  perimetroFinal: number;
  
  /** Linderos finales (registrales o calculados) */
  linderosFinal: LinderoRegistral[];
  
  /** Indicadores de calidad */
  flags: {
    /** Requiere revisión por discrepancia */
    requiresReview: boolean;
    
    /** Fuente de los datos */
    fuenteArea: 'REGISTRAL' | 'CALCULADO';
    fuentePerimetro: 'REGISTRAL' | 'CALCULADO';
    fuenteLinderos: 'REGISTRAL' | 'CALCULADO' | 'MIXTO';
    
    /** Advertencias */
    warnings: string[];
  };
  
  /** Datos calculados para comparación */
  datosCalculados?: {
    areaGeometrica: number;
    perimetroGeometrico: number;
    discrepanciaArea?: number; // porcentaje
    discrepanciaPerimetro?: number; // porcentaje
  };
}

/**
 * Segmento calculado del polígono
 */
interface SegmentoCalculado {
  index: number;
  verticeInicio: number[];
  verticeFin: number[];
  distancia: number;
  azimut: number;
  anguloInterno: number; // ángulo interno en el vértice (en grados)
  colindancia: string;
  orientacion: string;
  /** Si este lado es un arco de circunferencia (ver x_geometry_arcos en Odoo). */
  esArco?: boolean;
  /** Radio del arco (solo si esArco). */
  radioArco?: number;
}

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

export class PlanoDataProcessor {
  private payload: PlanoPayloadHibrido;
  private warnings: string[] = [];
  private ubicacionIncompleta = false;

  constructor(payload: PlanoPayloadHibrido) {
    this.payload = payload;
  }

  /**
   * Método principal: Procesa el payload y retorna datos preparados para renderizado
   */
  async process(): Promise<DatosProcesados> {
    // 1. Validar integridad
    this.validateIntegrity();

    // 2. Calcular datos geométricos (siempre, para comparación)
    const datosGeometricos = this.calculateGeometricData();

    // 3. Determinar datos finales (prioridad registral)
    const areaFinal = this.payload.datosRegistrales.areaOficial ?? datosGeometricos.area;
    const perimetroFinal = this.payload.datosRegistrales.perimetroOficial ?? datosGeometricos.perimetro;

    // 4. Check de tolerancia
    const discrepancias = this.checkTolerances(
      areaFinal,
      perimetroFinal,
      datosGeometricos.area,
      datosGeometricos.perimetro
    );

    // 5. Generar linderos (prioridad registral o fallback)
    const linderosFinal = await this.generateLinderos(datosGeometricos.segmentos);

    // 6. Construir resultado
    return {
      areaFinal,
      perimetroFinal,
      linderosFinal,
      flags: {
        requiresReview: discrepancias.requiresReview || this.ubicacionIncompleta,
        fuenteArea: this.payload.datosRegistrales.areaOficial !== null ? 'REGISTRAL' : 'CALCULADO',
        fuentePerimetro: this.payload.datosRegistrales.perimetroOficial !== null ? 'REGISTRAL' : 'CALCULADO',
        fuenteLinderos: this.determineFuenteLinderos(),
        warnings: this.warnings
      },
      datosCalculados: {
        areaGeometrica: datosGeometricos.area,
        perimetroGeometrico: datosGeometricos.perimetro,
        discrepanciaArea: discrepancias.areaDiscrepancia,
        discrepanciaPerimetro: discrepancias.perimetroDiscrepancia
      }
    };
  }

  // ==========================================================================
  // VALIDACIÓN
  // ==========================================================================

  /**
   * Valida la integridad estructural del payload
   */
  private validateIntegrity(): void {
    const { loteObjetivo, datosRegistrales } = this.payload;

    // Verificar que la geometría sea un polígono válido
    if (!loteObjetivo.geometry || loteObjetivo.geometry.type !== 'Polygon') {
      throw new Error('El lote objetivo debe ser un Polygon');
    }

    const coordinates = loteObjetivo.geometry.coordinates[0];
    if (coordinates.length < 4) {
      throw new Error('El polígono debe tener al menos 3 vértices (4 puntos con cierre)');
    }

    // Validar coherencia de linderos registrales
    if (datosRegistrales.linderos !== null) {
      const numLados = coordinates.length - 1; // Restamos 1 porque el último cierra el polígono
      const numLinderos = datosRegistrales.linderos.length;

      if (numLinderos !== numLados) {
        this.warnings.push(
          `ADVERTENCIA: Número de linderos registrales (${numLinderos}) no coincide con lados del polígono (${numLados}). Usando cálculo geométrico.`
        );
        // Forzar recálculo
        this.payload.datosRegistrales.linderos = null;
      }
    }

    // Ubicación administrativa incompleta: PlanoRequestAdapter y los
    // generadores ya NO sustituyen departamento/provincia/distrito faltantes
    // por 'Lima' en silencio (ver commit de este fix) — en vez de eso, un
    // dato faltante debe marcar el documento para revisión manual, no pasar
    // desapercibido con una ciudad inventada.
    const ubicacion = loteObjetivo.properties?.ubicacion;
    const PLACEHOLDER = '---';
    const camposFaltantes = (['departamento', 'provincia', 'distrito'] as const).filter(
      (campo) => !ubicacion?.[campo] || ubicacion[campo] === PLACEHOLDER,
    );

    if (camposFaltantes.length > 0) {
      this.warnings.push(
        `ADVERTENCIA: Ubicación administrativa incompleta (falta: ${camposFaltantes.join(', ')}). Verificar antes de emitir el documento.`,
      );
      this.ubicacionIncompleta = true;
    }
  }

  // ==========================================================================
  // CÁLCULOS GEOMÉTRICOS
  // ==========================================================================

  /**
   * Calcula área, perímetro y segmentos desde la geometría
   */
  private calculateGeometricData(): {
    area: number;
    perimetro: number;
    segmentos: SegmentoCalculado[];
  } {
    // Área y perímetro SÍ deben usar la geometría expandida (con los puntos
    // muestreados de cada arco): es la que da el área/perímetro real de la
    // curva, no de la cuerda recta entre sus 2 extremos.
    const polygon = turf.polygon(this.payload.loteObjetivo.geometry.coordinates);
    const area = turf.area(polygon);
    const perimetro = turf.length(polygon, { units: 'meters' });

    // Segmentos/linderos, en cambio, deben ser UNO POR LADO REAL: si se
    // usara la geometría expandida acá, un solo lado curvo (ej. arco de
    // 35.29 ml) se fragmentaría en ~16 micro-segmentos rectos de ~2 ml cada
    // uno (uno por punto muestreado), rompiendo el cuadro técnico y las
    // cotas del plano (cada micro-segmento aparecería como su propio
    // "lindero", con su propio ángulo interno casi-180° sin sentido).
    // verticesOriginales (ver PlanoRequestAdapter) trae el polígono SIN
    // expandir — un vértice real por esquina — para este cálculo.
    const coordinatesOriginales = (this.payload.loteObjetivo.properties as any)?.verticesOriginales as
      | [number, number][]
      | undefined;
    // verticesOriginales viene CERRADO (primer punto === último, igual que
    // geometry.coordinates) — hay que quitar ese duplicado para tener un
    // vértice por lado, igual que ya se hacía con la geometría expandida.
    const verticesUnicos: [number, number][] = coordinatesOriginales && coordinatesOriginales.length >= 4
      ? coordinatesOriginales.slice(0, -1)
      : (this.payload.loteObjetivo.geometry.coordinates[0].slice(0, -1) as [number, number][]);

    const arcos = ((this.payload.loteObjetivo.properties as any)?.arcos ?? []) as Array<{
      indiceVertice: number;
      radio: number;
      longitudArco: number;
      sentido: 'horario' | 'antihorario';
    }>;
    const arcoPorIndice = new Map(arcos.map((a) => [a.indiceVertice, a]));

    // Ángulos internos: calculados sobre los vértices REALES, de forma
    // robusta ante el sentido de recorrido del polígono (ver
    // calculateInteriorAngles). Usar los puntos muestreados de un arco acá
    // daría un ángulo ~180° sin sentido en esa esquina (son casi
    // colineales entre sí).
    const angulosInternos = calculateInteriorAngles(verticesUnicos);
    const segmentos: SegmentoCalculado[] = [];

    for (let i = 0; i < verticesUnicos.length; i++) {
      const inicio = verticesUnicos[i];
      const fin = verticesUnicos[(i + 1) % verticesUnicos.length];
      const arco = arcoPorIndice.get(i);

      // IMPORTANTE: Coordenadas UTM son planas en metros, usar distancia euclidiana
      const dx = fin[0] - inicio[0];
      const dy = fin[1] - inicio[1];
      const distanciaRecta = Math.sqrt(dx * dx + dy * dy);
      const distancia = arco ? arco.longitudArco : distanciaRecta;

      // Calcular azimut (bearing) manualmente para coordenadas planas
      // Azimut = atan2(ΔE, ΔN) convertido a grados desde el norte
      const azimut = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;

      segmentos.push({
        index: i,
        verticeInicio: inicio,
        verticeFin: fin,
        distancia,
        azimut,
        anguloInterno: angulosInternos[i],
        colindancia: '', // Se calculará después
        orientacion: '', // Se calculará después
        ...(arco ? { esArco: true, radioArco: arco.radio } : {}),
      } as SegmentoCalculado);
    }

    return { area, perimetro, segmentos };
  }

  /**
   * Verifica tolerancias entre datos registrales y calculados
   */
  private checkTolerances(
    areaRegistral: number,
    perimetroRegistral: number,
    areaCalculada: number,
    perimetroCalculada: number
  ): {
    requiresReview: boolean;
    areaDiscrepancia?: number;
    perimetroDiscrepancia?: number;
  } {
    let requiresReview = false;
    let areaDiscrepancia: number | undefined;
    let perimetroDiscrepancia: number | undefined;

    // Solo verificar si existen AMBOS datos
    if (this.payload.datosRegistrales.areaOficial !== null) {
      areaDiscrepancia = Math.abs((areaRegistral - areaCalculada) / areaRegistral);
      if (areaDiscrepancia > TOLERANCE_PERCENTAGE) {
        requiresReview = true;
        this.warnings.push(
          `ALERTA: Discrepancia de área mayor al ${TOLERANCE_PERCENTAGE * 100}%. Registral: ${areaRegistral.toFixed(2)} m², Calculada: ${areaCalculada.toFixed(2)} m² (${(areaDiscrepancia * 100).toFixed(2)}%)`
        );
      }
    }

    if (this.payload.datosRegistrales.perimetroOficial !== null) {
      perimetroDiscrepancia = Math.abs((perimetroRegistral - perimetroCalculada) / perimetroRegistral);
      if (perimetroDiscrepancia > TOLERANCE_PERCENTAGE) {
        requiresReview = true;
        this.warnings.push(
          `ALERTA: Discrepancia de perímetro mayor al ${TOLERANCE_PERCENTAGE * 100}%. Registral: ${perimetroRegistral.toFixed(2)} m, Calculado: ${perimetroCalculada.toFixed(2)} m (${(perimetroDiscrepancia * 100).toFixed(2)}%)`
        );
      }
    }

    return { requiresReview, areaDiscrepancia, perimetroDiscrepancia };
  }

  // ==========================================================================
  // GENERACIÓN DE LINDEROS
  // ==========================================================================

  /**
   * Genera linderos con LÓGICA HÍBRIDA INTELIGENTE (MERGE CAMPO POR CAMPO)
   *
   * REGLA: Por cada campo, usa el valor registral SI Y SOLO SI:
   * - No es null/undefined
   * - No está vacío (trim !== '')
   * - No es cero ('0', '0.0', '0.00')
   *
   * Si el campo registral NO cumple, usa el valor calculado.
   */
  private async generateLinderos(segmentos: SegmentoCalculado[]): Promise<LinderoRegistral[]> {
    const { datosRegistrales } = this.payload;

    // Calcular SIEMPRE los datos geométricos (pueden usarse como fallback)
    const linderosCalculados: LinderoRegistral[] = [];
    for (const segmento of segmentos) {
      const colindancia = await this.detectColindancia(segmento);
      const orientacion = this.determineOrientacion(segmento.azimut, segmentos);

      linderosCalculados.push({
        index: segmento.index,
        tramo: `V${segmento.index + 1} - V${((segmento.index + 1) % segmentos.length) + 1}`,
        longitudTexto: segmento.distancia.toFixed(2),
        anguloInterno: segmento.anguloInterno,
        colindanciaTexto: colindancia,
        orientacion: orientacion as any,
        ...(segmento.esArco ? { esArco: true, radioArco: segmento.radioArco } : {}),
      });
    }

    // CASO A: No hay datos registrales → usar calculados
    if (!datosRegistrales.linderos || datosRegistrales.linderos.length === 0) {
      return linderosCalculados;
    }

    // CASO B: Hay datos registrales → MERGE INTELIGENTE campo por campo
    const linderosMerged: LinderoRegistral[] = [];
    
    for (let i = 0; i < segmentos.length; i++) {
      const registral = datosRegistrales.linderos[i];
      const calculado = linderosCalculados[i];

      // Helper: Valida si un valor es "válido" (no vacío ni cero)
      const esValorValido = (valor: any): boolean => {
        // Validar null/undefined
        if (valor === null || valor === undefined) return false;
        
        // Convertir a string y limpiar espacios
        const str = String(valor).trim();
        
        // Validar string vacío
        if (str === '') return false;
        
        // Validar si es cero (tanto string como número, con cualquier cantidad de decimales)
        const num = parseFloat(str);
        if (!isNaN(num) && num === 0) return false;
        
        return true;
      };

      linderosMerged.push({
        index: calculado.index,
        tramo: esValorValido(registral?.tramo) ? registral.tramo : calculado.tramo,
        longitudTexto: esValorValido(registral?.longitudTexto) ? registral.longitudTexto : calculado.longitudTexto,
        anguloInterno: esValorValido(registral?.anguloInterno) ? registral.anguloInterno : calculado.anguloInterno,
        colindanciaTexto: esValorValido(registral?.colindanciaTexto) ? registral.colindanciaTexto : calculado.colindanciaTexto,
        orientacion: (registral?.orientacion as any) || calculado.orientacion,
        ...(calculado.esArco ? { esArco: true, radioArco: calculado.radioArco } : {}),
      });
    }

    return linderosMerged;
  }

  /**
   * Detecta la colindancia de un segmento mediante raycasting
   */
  private async detectColindancia(segmento: SegmentoCalculado): Promise<string> {
    const { contexto } = this.payload;

    // Crear línea del segmento
    const lineString = turf.lineString([segmento.verticeInicio, segmento.verticeFin]);

    // Crear buffer pequeño para detección
    const buffered = turf.buffer(lineString, BUFFER_DETECTION_RADIUS, { units: 'meters' });

    if (!buffered) {
      return 'Colindancia no determinada';
    }

    // Buscar intersecciones con elementos del contexto
    for (const feature of contexto.features) {
      try {
        const intersects = turf.booleanIntersects(buffered, feature.geometry as any);

        if (intersects) {
          const { tipo, nombre, numeroLote } = feature.properties;

          if (tipo === 'calle' && nombre) {
            return nombre;
          } else if (tipo === 'lote' && numeroLote) {
            return `Lote ${numeroLote}`;
          } else if (nombre) {
            return nombre;
          }
        }
      } catch (error) {
        // Ignorar errores de geometría inválida
        console.warn('Error detectando colindancia:', error);
      }
    }

    return 'Colindancia no determinada';
  }

  /**
   * Determina la orientación relativa de un segmento
   */
  private determineOrientacion(azimut: number, todosSegmentos: SegmentoCalculado[]): string {
    // Normalizar azimut a 0-360
    const azimutNorm = ((azimut % 360) + 360) % 360;

    // Encontrar el segmento principal (asumimos que el frente es el de mayor longitud hacia el norte)
    const segmentoFrente = todosSegmentos.reduce((prev, current) =>
      current.distancia > prev.distancia ? current : prev
    );

    const azimutFrente = ((segmentoFrente.azimut % 360) + 360) % 360;

    // Calcular diferencia angular
    let diff = azimutNorm - azimutFrente;
    if (diff < 0) diff += 360;
    if (diff > 180) diff = 360 - diff;

    // Determinar orientación relativa
    if (Math.abs(azimutNorm - azimutFrente) < ANGLE_THRESHOLD) {
      return 'FRENTE';
    } else if (Math.abs(diff - 90) < ANGLE_THRESHOLD) {
      return 'DERECHA';
    } else if (Math.abs(diff - 180) < ANGLE_THRESHOLD) {
      return 'FONDO';
    } else if (Math.abs(diff - 270) < ANGLE_THRESHOLD) {
      return 'IZQUIERDA';
    }

    // Fallback a orientación cardinal
    if (azimutNorm >= 315 || azimutNorm < 45) return 'FRENTE'; // Norte
    if (azimutNorm >= 45 && azimutNorm < 135) return 'DERECHA'; // Este
    if (azimutNorm >= 135 && azimutNorm < 225) return 'FONDO'; // Sur
    return 'IZQUIERDA'; // Oeste
  }

  /**
   * Determina la fuente de los linderos
   */
  private determineFuenteLinderos(): 'REGISTRAL' | 'CALCULADO' | 'MIXTO' {
    if (this.payload.datosRegistrales.linderos !== null) {
      return 'REGISTRAL';
    }
    return 'CALCULADO';
  }
}

// ============================================================================
// FUNCIÓN AUXILIAR DE USO RÁPIDO
// ============================================================================

/**
 * Función auxiliar para procesar un payload rápidamente
 */
export async function procesarDatosPlano(
  payload: PlanoPayloadHibrido
): Promise<DatosProcesados> {
  const processor = new PlanoDataProcessor(payload);
  return await processor.process();
}
