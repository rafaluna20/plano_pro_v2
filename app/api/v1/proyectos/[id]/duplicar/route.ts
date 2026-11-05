import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { autenticarSesion, respuestaErrorBD } from '@/lib/auth/sessionAuth';
import { MAX_PROYECTOS_POR_USUARIO } from '@/lib/validators/proyectos';
import { ApiResponse } from '@/types/api';

export const dynamic = 'force-dynamic';

const error = (status: number, code: string, message: string) =>
  NextResponse.json<ApiResponse>({ success: false, error: { code, message } }, { status });

/** Copia un proyecto propio: queda con el nombre "<nombre> (copia)" y los mismos datos. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = autenticarSesion(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const origen = await prisma.proyecto.findFirst({ where: { id, userId: auth.userId } });
    if (!origen) return error(404, 'NO_ENCONTRADO', 'El proyecto no existe o no es tuyo.');

    const total = await prisma.proyecto.count({ where: { userId: auth.userId } });
    if (total >= MAX_PROYECTOS_POR_USUARIO) {
      return error(400, 'LIMITE_PROYECTOS', `Llegaste al máximo de ${MAX_PROYECTOS_POR_USUARIO} proyectos. Elimina alguno para duplicar.`);
    }

    const sufijo = ' (copia)';
    const nombre = origen.nombre.slice(0, 120 - sufijo.length) + sufijo;
    const copia = await prisma.proyecto.create({
      data: {
        userId: auth.userId,
        nombre,
        datos: origen.datos as object,
        resumen: (origen.resumen ?? undefined) as object | undefined,
      },
      select: { id: true, nombre: true, updatedAt: true },
    });
    return NextResponse.json<ApiResponse>({ success: true, data: copia }, { status: 201 });
  } catch (e) {
    return respuestaErrorBD(e);
  }
}
