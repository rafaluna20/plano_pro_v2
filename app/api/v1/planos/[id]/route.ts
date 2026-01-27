import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { validateApiKey } from '@/lib/auth/api-keys';
import { ApiResponse } from '@/types/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params en Next.js 15+
    const { id } = await params;
    
    // 1. Autenticación
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key requerida en header X-API-Key'
        }
      }, { status: 401 });
    }

    const apiKeyRecord = await validateApiKey(apiKey);
    if (!apiKeyRecord) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API key inválida o expirada'
        }
      }, { status: 401 });
    }

    // 2. Buscar plano
    const plano = await prisma.plano.findUnique({
      where: { id },
      select: {
        id: true,
        loteCodigo: true,
        loteNombre: true,
        manzana: true,
        etapa: true,
        numeroLote: true,
        vertices: true,
        dimensiones: true,
        colindancias: true,
        propietario: true,
        pdfUrl: true,
        pdfSize: true,
        thumbnailUrl: true,
        status: true,
        jobId: true,
        errorMessage: true,
        config: true,
        source: true,
        generatedAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!plano) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Plano no encontrado'
        }
      }, { status: 404 });
    }

    // 3. Respuesta
    return NextResponse.json<ApiResponse>({
      success: true,
      data: plano
    });

  } catch (error) {
    console.error('Error obteniendo plano:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 1. Autenticación (Permitimos DELETE sin API Key si hay sesión de usuario, pero por consistencia usamos API Key si viene)
    // TODO: Idealmente verificar sesión de usuario si no hay API Key
    const apiKey = request.headers.get('x-api-key');
    
    if (apiKey) {
        const apiKeyRecord = await validateApiKey(apiKey);
        if (!apiKeyRecord) {
            return NextResponse.json<ApiResponse>({
                success: false,
                error: { code: 'INVALID_API_KEY', message: 'API key inválida' }
            }, { status: 401 });
        }
        // Validar que el plano pertenezca al usuario de la API Key
        const plano = await prisma.plano.findUnique({ where: { id }, select: { userId: true } });
        if (plano && plano.userId !== apiKeyRecord.userId) {
             return NextResponse.json<ApiResponse>({
                success: false,
                error: { code: 'FORBIDDEN', message: 'No tienes permiso para eliminar este plano' }
            }, { status: 403 });
        }
    }

    // 2. Eliminar de la base de datos
    // Nota: Prisma se encarga de eliminar registros relacionados si está configurado en cascada,
    // pero los archivos físicos (PDFs) deberían borrarse también.
    // Por simplicidad aquí borramos solo el registro DB.
    
    await prisma.plano.delete({
      where: { id }
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: 'Plano eliminado correctamente' }
    });

  } catch (error) {
    console.error('Error eliminando plano:', error);
    
    // Si no existe el registro
    if ((error as any).code === 'P2025') {
        return NextResponse.json<ApiResponse>({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Plano no encontrado' }
        }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error al eliminar el plano',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}
