/**
 * API Route: Generación Híbrida de Planos Perimétricos
 * 
 * Endpoint que implementa el flujo completo híbrido:
 * 1. Validación de payload
 * 2. Procesamiento con lógica híbrida (PlanoDataProcessor)
 * 3. Generación PDF con datos procesados (PlanoPerimetricoGeneratorV2)
 * 4. Respuesta directa con PDF
 * 
 * FILOSOFÍA: "El texto registral manda sobre el dibujo"
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import type { PlanoPayloadHibrido } from '@/types/PlanosPayload';
import { PlanoDataProcessor } from '@/lib/services/PlanoDataProcessor';
import { PlanoPerimetricoGeneratorV2 } from '@/lib/generators/PlanoPerimetricoGeneratorV2';

// =============================================================================
// CONFIGURACIÓN
// =============================================================================

export const runtime = 'nodejs';
export const maxDuration = 60;

// =============================================================================
// TIPOS DE RESPUESTA
// =============================================================================

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

interface SuccessMetadata {
  loteCodigo: string;
  areaFinal: number;
  perimetroFinal: number;
  fuenteDatos: {
    area: 'REGISTRAL' | 'CALCULADO';
    perimetro: 'REGISTRAL' | 'CALCULADO';
    linderos: 'REGISTRAL' | 'CALCULADO' | 'MIXTO';
  };
  warnings: string[];
  requiresReview: boolean;
  discrepancias?: {
    area?: number;
    perimetro?: number;
  };
}

// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // =========================================================================
    // 1. PARSEO Y VALIDACIÓN BÁSICA
    // =========================================================================
    
    let payload: PlanoPayloadHibrido;
    try {
      payload = await request.json();
    } catch (e) {
      return NextResponse.json<ErrorResponse>({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'El cuerpo de la petición no es un JSON válido'
        }
      }, { status: 400 });
    }

    // Validación estructural mínima
    if (!payload.loteObjetivo?.geometry?.coordinates) {
      return NextResponse.json<ErrorResponse>({
        success: false,
        error: {
          code: 'MISSING_GEOMETRY',
          message: 'El payload debe incluir loteObjetivo.geometry.coordinates'
        }
      }, { status: 400 });
    }

    if (!payload.meta?.solicitudId) {
      return NextResponse.json<ErrorResponse>({
        success: false,
        error: {
          code: 'MISSING_METADATA',
          message: 'El payload debe incluir meta.solicitudId'
        }
      }, { status: 400 });
    }

    // =========================================================================
    // 2. PROCESAMIENTO HÍBRIDO (Prioridad Registral con Fallback Geométrico)
    // =========================================================================
    
    console.log(`[${payload.meta.solicitudId}] Iniciando procesamiento híbrido...`);
    
    const processor = new PlanoDataProcessor(payload);
    let processedData;
    
    try {
      processedData = await processor.process();
    } catch (error) {
      return NextResponse.json<ErrorResponse>({
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Error durante el procesamiento de datos',
          details: error instanceof Error ? error.message : 'Unknown processing error'
        }
      }, { status: 400 });
    }

    // Log de información del procesamiento
    console.log(`[${payload.meta.solicitudId}] Procesamiento completado:`, {
      areaFinal: processedData.areaFinal,
      fuenteArea: processedData.flags.fuenteArea,
      warnings: processedData.flags.warnings.length
    });

    // =========================================================================
    // 3. GENERACIÓN DEL PDF (Con datos procesados)
    // =========================================================================
    
    console.log(`[${payload.meta.solicitudId}] Generando PDF...`);
    
    const pdf = new jsPDF({
      orientation: payload.configImpresion?.orientacion || 'landscape',
      unit: 'mm',
      format: payload.configImpresion?.formatoPapel || 'a3',
      compress: true
    });

    const generator = new PlanoPerimetricoGeneratorV2(payload, processedData);
    
    try {
      await generator.generate(pdf);
    } catch (error) {
      return NextResponse.json<ErrorResponse>({
        success: false,
        error: {
          code: 'GENERATION_ERROR',
          message: 'Error durante la generación del PDF',
          details: error instanceof Error ? error.message : 'Unknown generation error'
        }
      }, { status: 500 });
    }

    // =========================================================================
    // 4. CONSTRUCCIÓN DE METADATA DE RESPUESTA
    // =========================================================================
    
    const metadata: SuccessMetadata = {
      loteCodigo: payload.loteObjetivo.properties.identificador.lote,
      areaFinal: processedData.areaFinal,
      perimetroFinal: processedData.perimetroFinal,
      fuenteDatos: {
        area: processedData.flags.fuenteArea,
        perimetro: processedData.flags.fuentePerimetro,
        linderos: processedData.flags.fuenteLinderos
      },
      warnings: processedData.flags.warnings,
      requiresReview: processedData.flags.requiresReview,
      discrepancias: processedData.datosCalculados ? {
        area: processedData.datosCalculados.discrepanciaArea,
        perimetro: processedData.datosCalculados.discrepanciaPerimetro
      } : undefined
    };

    // =========================================================================
    // 5. RESPUESTA CON PDF
    // =========================================================================
    
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    const duration = Date.now() - startTime;

    console.log(`[${payload.meta.solicitudId}] PDF generado exitosamente en ${duration}ms`);

    // Agregar metadata en headers personalizados
    const headers = new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="plano_${payload.loteObjetivo.properties.identificador.lote}_${Date.now()}.pdf"`,
      'X-Generation-Time': duration.toString(),
      'X-Data-Source-Area': metadata.fuenteDatos.area,
      'X-Data-Source-Perimeter': metadata.fuenteDatos.perimetro,
      'X-Data-Source-Linderos': metadata.fuenteDatos.linderos,
      'X-Requires-Review': metadata.requiresReview.toString(),
      'X-Warnings-Count': metadata.warnings.length.toString()
    });

    // Si hay warnings críticos, agregar header específico
    if (metadata.requiresReview) {
      headers.set('X-Review-Required', 'true');
      headers.set('X-Review-Reason', metadata.warnings.join('; '));
    }

    return new NextResponse(pdfBuffer, { 
      status: 200,
      headers 
    });

  } catch (error) {
    console.error('ERROR CRÍTICO en generar-hibrido:', error);
    
    return NextResponse.json<ErrorResponse>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

// =============================================================================
// ENDPOINTS ADICIONALES (Opcional)
// =============================================================================

/**
 * GET: Retorna información sobre la API híbrida
 */
export async function GET() {
  return NextResponse.json({
    service: 'Plano Perimétrico - Generación Híbrida V2',
    version: '2.0.0',
    description: 'Endpoint de generación con lógica híbrida: Prioridad Registral con Fallback Geométrico',
    features: [
      'Consumo de datos registrales cuando existen',
      'Cálculo automático desde geometría como fallback',
      'Detección automática de colindancias con Turf.js',
      'Auto-scale inteligente en plano de ubicación',
      'Validación de coherencia (área, perímetro, linderos)',
      'Generación de advertencias para revisión manual'
    ],
    philosophy: 'El texto registral manda sobre el dibujo',
    usage: {
      method: 'POST',
      contentType: 'application/json',
      payloadSchema: 'PlanoPayloadHibrido',
      response: 'application/pdf (binary)',
      headers: {
        'X-Generation-Time': 'Tiempo de generación en ms',
        'X-Data-Source-Area': 'REGISTRAL | CALCULADO',
        'X-Data-Source-Perimeter': 'REGISTRAL | CALCULADO',
        'X-Data-Source-Linderos': 'REGISTRAL | CALCULADO | MIXTO',
        'X-Requires-Review': 'true si hay discrepancias >2%',
        'X-Warnings-Count': 'Número de advertencias generadas'
      }
    },
    endpoints: {
      generate: 'POST /api/v1/planos/generar-hibrido',
      info: 'GET /api/v1/planos/generar-hibrido'
    }
  });
}
