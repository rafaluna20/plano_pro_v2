import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { autenticarSesion, respuestaErrorBD } from '@/lib/auth/sessionAuth';
import { proyectoBodySchema, excedeLimite } from '@/lib/validators/proyectos';
import { resumirProyecto } from '@/lib/editor/proyectos';
import { ApiResponse } from '@/types/api';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

const error = (status: number, code: string, message: string, details?: unknown) =>
  NextResponse.json<ApiResponse>({ success: false, error: { code, message, details } }, { status });

const noExiste = () => error(404, 'NO_ENCONTRADO', 'El proyecto no existe o no es tuyo.');

/** Abre un proyecto (con todos sus datos). Solo el dueño puede verlo. */
export async function GET(request: NextRequest, { params }: Contexto) {
  const auth = autenticarSesion(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const p = await prisma.proyecto.findFirst({
      where: { id, userId: auth.userId },
      select: { id: true, nombre: true, datos: true, createdAt: true, updatedAt: true },
    });
    return p ? NextResponse.json<ApiResponse>({ success: true, data: p }) : noExiste();
  } catch (e) {
    return respuestaErrorBD(e);
  }
}

/** Guarda cambios de un proyecto existente (nombre y datos). */
export async function PUT(request: NextRequest, { params }: Contexto) {
  const auth = autenticarSesion(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return error(400, 'JSON_INVALIDO', 'El cuerpo de la petición no es JSON válido.');
  }
  const v = proyectoBodySchema.safeParse(cuerpo);
  if (!v.success) return error(400, 'VALIDACION', v.error.issues[0]?.message ?? 'Datos inválidos', v.error.format());
  if (excedeLimite(v.data.datos)) {
    return error(413, 'PROYECTO_MUY_GRANDE', 'El proyecto es demasiado grande para guardarlo (máx. 4 MB). Reduce los vecinos importados o la imagen.');
  }

  try {
    const r = await prisma.proyecto.updateMany({
      where: { id, userId: auth.userId },
      data: {
        nombre: v.data.nombre,
        datos: v.data.datos as object,
        resumen: resumirProyecto(v.data.datos.data) as object,
      },
    });
    if (r.count === 0) return noExiste();
    const p = await prisma.proyecto.findUnique({ where: { id }, select: { id: true, nombre: true, updatedAt: true } });
    return NextResponse.json<ApiResponse>({ success: true, data: p });
  } catch (e) {
    return respuestaErrorBD(e);
  }
}

/** Elimina un proyecto. Solo el dueño. */
export async function DELETE(request: NextRequest, { params }: Contexto) {
  const auth = autenticarSesion(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const r = await prisma.proyecto.deleteMany({ where: { id, userId: auth.userId } });
    return r.count === 0 ? noExiste() : NextResponse.json<ApiResponse>({ success: true, data: { id } });
  } catch (e) {
    return respuestaErrorBD(e);
  }
}
