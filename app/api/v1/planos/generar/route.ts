import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';
import { generarPlanosSchema } from '@/lib/validators/apiSchemas';
import { queuePlanoGeneration } from '@/lib/queue/jobs';
import { GenerarPlanosRequest, GenerarPlanosResponse } from '@/types/planos';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. AUTENTICACIÓN + RATE LIMITING
    const auth = await authenticateApiRequest(request);
    if (!auth.ok) return auth.response;
    const { apiKeyRecord } = auth;

    // 2. PARSEO Y VALIDACIÓN DEL PAYLOAD
    // Se espera que el JSON cumpla con la estructura nueva (vectores, imagen, colindancias separadas)
    let body: any;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_JSON', message: 'El cuerpo de la petición no es un JSON válido' } }, { status: 400 });
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

    // 3. PERSISTENCIA EN BASE DE DATOS (Registro de la solicitud)
    // Guardamos los datos estructurales.
    // NOTA: NO guardamos 'imagenContexto' (Base64) en la BD para evitar problemas de rendimiento/espacio.
    // Esa imagen solo vivirá en la memoria del Job de generación.
    const plano = await prisma.plano.create({
      data: {
        loteCodigo: payload.lote.codigo,
        loteNombre: payload.lote.nombre,
        manzana: payload.lote.manzana,
        etapa: payload.lote.etapa,
        numeroLote: payload.lote.numeroLote,

        // Ubicación administrativa (departamento/provincia/distrito/zonaUTM).
        // Antes no se guardaba en ningún lado: solo vivía de paso en el job
        // de Redis durante la generación y se perdía después, sin forma de
        // auditar qué ubicación se usó en un plano ya generado.
        ubicacion: payload.lote.ubicacion ? (payload.lote.ubicacion as any) : null,

        // Guardamos la geometría principal y metadatos
        vertices: payload.vertices as any,
        dimensiones: payload.dimensiones as any,
        colindancias: payload.colindancias as any, // Ahora es el array limpio de textos
        contexto: (payload.contexto || {}) as any, // Guardamos los vectores de vecinos (son ligeros)
        
        propietario: payload.propietario ? (payload.propietario as any) : null,
        config: (payload.config || {}) as any,
        
        userId: apiKeyRecord.userId,
        source: 'api',
        status: 'PENDING'
      }
    });

    // 4. ENCOLAR JOB DE GENERACIÓN (Asíncrono)
    // Aquí sí pasamos el payload completo, incluyendo la imagen Base64
    const jobConfig = {
      incluirMemoriaDescriptiva: true,
      incluirPlanoPerimetrico: true,
      incluirPlanoUbicacion: true,
      formatoPapel: 'A3' as const, // Default general
      orientacion: 'landscape' as const,
      incluirColindantesEnPlano: true,
      ...payload.config
    };

    const job = await queuePlanoGeneration({
      planoId: plano.id,
      vertices: payload.vertices,
      dimensiones: payload.dimensiones,
      lote: payload.lote,
      colindancias: payload.colindancias,
      propietario: payload.propietario,
      
      // NUEVOS CAMPOS CRÍTICOS PARA EL CONTEXTO
      contexto: payload.contexto,         // Prioridad 1: Vectores
      imagenContexto: payload.imagenContexto, // Prioridad 2: Captura Pantalla (Pasa al worker pero no a BD)
      
      config: jobConfig,
      userId: apiKeyRecord.userId
    });

    // Actualizamos el registro con el ID del trabajo en cola
    await prisma.plano.update({
      where: { id: plano.id },
      data: { jobId: job.id }
    });

    // 5. LOG DE AUDITORÍA
    // Registramos que se usó la API
    await prisma.apiLog.create({
      data: {
        apiKeyId: apiKeyRecord.id,
        endpoint: '/api/v1/planos/generar',
        method: 'POST',
        statusCode: 202,
        duration: Date.now() - startTime,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        metadata: {
          hasContextVectors: !!payload.contexto?.elementos?.length,
          hasContextImage: !!payload.imagenContexto?.data
        }
      }
    });

    // 6. RESPUESTA AL CLIENTE
    return NextResponse.json<GenerarPlanosResponse>({
      success: true,
      data: {
        planoId: plano.id,
        jobId: job.id,
        status: 'pending',
        metadata: {
          loteCodigo: payload.lote.codigo,
          fechaGeneracion: new Date().toISOString(),
          documentosIncluidos: ['MEMORIA_DESCRIPTIVA', 'PLANO_PERIMETRICO', 'PLANO_UBICACION'],
          mensaje: 'Generación iniciada. Use el endpoint de estado para verificar progreso.',
          estrategiaContexto: payload.contexto?.elementos?.length ? 'VECTORIAL' : (payload.imagenContexto ? 'IMAGEN' : 'MAPA_SERVER')
        }
      }
    }, { status: 202 });

  } catch (error) {
    console.error('CRITICAL ERROR en route.ts:', error);
    
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

// Configuración de Next.js
export const runtime = 'nodejs'; // Necesario para libs de canvas/pdf
export const maxDuration = 60; // Aumentamos timeout a 60s por si la subida de imagen es lenta