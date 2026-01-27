import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { validateApiKey } from '@/lib/auth/api-keys';
import { listPlanosQuerySchema } from '@/lib/validators/apiSchemas';
import { ApiResponse } from '@/types/api';

export async function GET(request: NextRequest) {
  try {
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

    // 2. Parsear query params
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validation = listPlanosQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parámetros de consulta inválidos',
          details: validation.error.format()
        }
      }, { status: 400 });
    }

    const { page, pageSize, status, loteCodigo, dateFrom, dateTo, sortBy, sortOrder } = validation.data;

    // 3. Construir filtros
    const where: any = {
      userId: apiKeyRecord.userId,
    };

    if (status) {
      where.status = status;
    }

    if (loteCodigo) {
      where.loteCodigo = {
        contains: loteCodigo,
        mode: 'insensitive'
      };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // 4. Contar total
    const total = await prisma.plano.count({ where });

    // 5. Obtener planos paginados
    const planos = await prisma.plano.findMany({
      where,
      select: {
        id: true,
        loteCodigo: true,
        loteNombre: true,
        manzana: true,
        etapa: true,
        numeroLote: true,
        pdfUrl: true,
        thumbnailUrl: true,
        status: true,
        generatedAt: true,
        createdAt: true,
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 6. Respuesta
    return NextResponse.json<ApiResponse>({
      success: true,
      data: planos,
      metadata: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }
    });

  } catch (error) {
    console.error('Error listando planos:', error);
    
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
