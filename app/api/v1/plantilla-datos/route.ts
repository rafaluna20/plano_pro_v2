import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { autenticarSesion, respuestaErrorBD } from '@/lib/auth/sessionAuth';
import { plantillaBodySchema } from '@/lib/validators/proyectos';
import { ApiResponse } from '@/types/api';

export const dynamic = 'force-dynamic';

/** Datos frecuentes del usuario (profesional, ubicación, trámite). `null` si aún no guardó. */
export async function GET(request: NextRequest) {
  const auth = autenticarSesion(request);
  if (!auth.ok) return auth.response;
  try {
    const p = await prisma.plantillaDatos.findUnique({ where: { userId: auth.userId }, select: { datos: true } });
    return NextResponse.json<ApiResponse>({ success: true, data: { datos: p?.datos ?? null } });
  } catch (e) {
    return respuestaErrorBD(e);
  }
}

/** Guarda (reemplaza) los datos frecuentes del usuario. */
export async function PUT(request: NextRequest) {
  const auth = autenticarSesion(request);
  if (!auth.ok) return auth.response;

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: 'JSON_INVALIDO', message: 'El cuerpo de la petición no es JSON válido.' } },
      { status: 400 },
    );
  }
  const v = plantillaBodySchema.safeParse(cuerpo);
  if (!v.success) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: 'VALIDACION', message: v.error.issues[0]?.message ?? 'Datos inválidos' } },
      { status: 400 },
    );
  }

  try {
    await prisma.plantillaDatos.upsert({
      where: { userId: auth.userId },
      create: { userId: auth.userId, datos: v.data.datos },
      update: { datos: v.data.datos },
    });
    return NextResponse.json<ApiResponse>({ success: true, data: { datos: v.data.datos } });
  } catch (e) {
    return respuestaErrorBD(e);
  }
}
