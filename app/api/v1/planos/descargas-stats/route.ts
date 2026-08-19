import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { authenticateApiRequest } from '@/lib/auth/apiAuth';

/**
 * Estadísticas de descargas del documento "resumen" (ver
 * /api/v1/planos/generar-resumen), más el total de expedientes completos
 * generados (de Plano, ya existente — no hace falta trackear "descargas"
 * ahí, ese documento se genera una vez por click de "Generar" y queda
 * como link directo al blob, no pasa por este backend en cada descarga).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth.ok) return auth.response;

    const [totalResumenDescargas, totalCompletosGenerados, porUsuario] = await Promise.all([
      prisma.planoDescarga.count(),
      prisma.plano.count({ where: { status: 'COMPLETED' } }),
      prisma.planoDescarga.groupBy({
        by: ['staffUid', 'staffNombre'],
        _count: { _all: true },
        orderBy: { _count: { staffUid: 'desc' } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalResumenDescargas,
        totalCompletosGenerados,
        porUsuario: porUsuario.map((row) => ({
          staffUid: row.staffUid,
          staffNombre: row.staffNombre,
          resumenDescargas: row._count._all,
        })),
      },
    });

  } catch (error) {
    console.error('ERROR en descargas-stats:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}
