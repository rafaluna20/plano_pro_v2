import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';
import { generarPlanosSchema } from '@/lib/validators/apiSchemas';
import { PlanoGenerator } from '@/lib/generators/PlanoGenerator';
import { GenerarPlanosRequest, GenerarPlanosResponse } from '@/types/planos';

/**
 * Documento "Plano Perimétrico de la Matriz" (el predio original completo
 * antes de la subdivisión en lotes) — igual que /generar-resumen, síncrono
 * y sin pasar por BullMQ (dibujo vectorial puro, sin llamadas externas). El
 * config lo decide este endpoint, no el caller: sin memoria descriptiva
 * (una matriz no tiene propietario/manzana/lote en el sentido comercial),
 * plano perimétrico completo + su copia, sin plano de ubicación aparte.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const auth = await authenticateApiRequest(request);
    if (!auth.ok) return auth.response;
    const { apiKeyRecord } = auth;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<GenerarPlanosResponse>({
        success: false,
        error: { code: 'INVALID_JSON', message: 'El cuerpo de la petición no es un JSON válido' }
      }, { status: 400 });
    }

    const validation = generarPlanosSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json<GenerarPlanosResponse>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos en el request',
          details: validation.error.format()
        }
      }, { status: 400 });
    }

    const payload: GenerarPlanosRequest = validation.data;

    const matrizRequest: GenerarPlanosRequest = {
      ...payload,
      config: {
        incluirMemoriaDescriptiva: false,
        incluirPlanoPerimetrico: true,
        incluirPlanoPerimetricoCopia: true,
        incluirPlanoUbicacion: false,
        incluirColindantesEnPlano: true,
      },
    };

    const generator = new PlanoGenerator(matrizRequest);
    const pdfBuffer = await generator.generate();

    const duration = Date.now() - startTime;

    // Misma tabla de auditoría que /generar-resumen — loteCodigo acá es el
    // código de la matriz (elemento.urbano), no un product.template.
    await prisma.planoDescarga.create({
      data: {
        loteCodigo: payload.lote.codigo,
        staffUid: payload.staff?.uid,
        staffNombre: payload.staff?.nombre,
      },
    });

    await prisma.apiLog.create({
      data: {
        apiKeyId: apiKeyRecord.id,
        endpoint: '/api/v1/planos/generar-matriz',
        method: 'POST',
        statusCode: 200,
        duration,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        metadata: {
          loteCodigo: payload.lote.codigo,
          staffUid: payload.staff?.uid ?? null,
          staffNombre: payload.staff?.nombre ?? null,
        },
      },
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="matriz_${payload.lote.codigo}.pdf"`,
        'X-Generation-Time': duration.toString(),
      },
    });

  } catch (error) {
    console.error('CRITICAL ERROR en generar-matriz:', error);
    return NextResponse.json<GenerarPlanosResponse>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor procesando la solicitud',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
