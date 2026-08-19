import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';
import { generarPlanosSchema } from '@/lib/validators/apiSchemas';
import { PlanoGenerator } from '@/lib/generators/PlanoGenerator';
import { GenerarPlanosRequest, GenerarPlanosResponse } from '@/types/planos';

/**
 * Documento "resumen": Memoria (solo sección III de linderos) + Plano
 * Perimétrico Copia — pensado para que staff no-administrador de
 * mapa_renasur pueda descargar algo útil sin exponer el expediente
 * completo (todavía en ajuste, ver el gate isSystem en
 * mapa_renasur/api/planos/generar). El config del documento lo decide
 * este endpoint, no el caller: sin importar qué config traiga el body,
 * siempre se genera exactamente linderos + copia, nunca más.
 *
 * A diferencia de /generar, no pasa por la cola de BullMQ: no hay modo
 * satelital/imagen acá (ninguna llamada externa a Google Maps), así que
 * generar y responder en la misma request es rápido y evita el peso de
 * crear un registro Plano + job + polling para 1-2 páginas de dibujo
 * vectorial puro.
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

    const resumenRequest: GenerarPlanosRequest = {
      ...payload,
      config: {
        incluirMemoriaDescriptiva: true,
        soloSeccionLinderosEnMemoria: true,
        incluirPlanoPerimetrico: false,
        incluirPlanoPerimetricoCopia: true,
        incluirPlanoUbicacion: false,
        incluirColindantesEnPlano: true,
      },
    };

    const generator = new PlanoGenerator(resumenRequest);
    const pdfBuffer = await generator.generate();

    const duration = Date.now() - startTime;

    // Auditoría: quién descargó el resumen de qué lote y cuándo. No se
    // persiste el PDF (efímero, se regenera al vuelo en cada descarga).
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
        endpoint: '/api/v1/planos/generar-resumen',
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
        'Content-Disposition': `attachment; filename="resumen_${payload.lote.codigo}.pdf"`,
        'X-Generation-Time': duration.toString(),
      },
    });

  } catch (error) {
    console.error('CRITICAL ERROR en generar-resumen:', error);
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
export const maxDuration = 30; // sin llamadas externas, debería ser mucho más rápido que esto
