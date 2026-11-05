import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { autenticarSesion, respuestaErrorBD } from '@/lib/auth/sessionAuth';
import { proyectoBodySchema, excedeLimite, MAX_PROYECTOS_POR_USUARIO } from '@/lib/validators/proyectos';
import { resumirProyecto } from '@/lib/editor/proyectos';
import { ApiResponse } from '@/types/api';

export const dynamic = 'force-dynamic';

const error = (status: number, code: string, message: string, details?: unknown) =>
  NextResponse.json<ApiResponse>({ success: false, error: { code, message, details } }, { status });

/** Lista de proyectos del usuario (sin el JSON grande), el más reciente primero. */
export async function GET(request: NextRequest) {
  const auth = autenticarSesion(request);
  if (!auth.ok) return auth.response;
  try {
    const proyectos = await prisma.proyecto.findMany({
      where: { userId: auth.userId },
      orderBy: { updatedAt: 'desc' },
      take: MAX_PROYECTOS_POR_USUARIO,
      select: { id: true, nombre: true, resumen: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json<ApiResponse>({ success: true, data: { proyectos } });
  } catch (e) {
    return respuestaErrorBD(e);
  }
}

/** Crea un proyecto nuevo. */
export async function POST(request: NextRequest) {
  const auth = autenticarSesion(request);
  if (!auth.ok) return auth.response;

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
    const total = await prisma.proyecto.count({ where: { userId: auth.userId } });
    if (total >= MAX_PROYECTOS_POR_USUARIO) {
      return error(400, 'LIMITE_PROYECTOS', `Llegaste al máximo de ${MAX_PROYECTOS_POR_USUARIO} proyectos. Elimina alguno para guardar otro.`);
    }
    const creado = await prisma.proyecto.create({
      data: {
        userId: auth.userId,
        nombre: v.data.nombre,
        datos: v.data.datos as object,
        resumen: resumirProyecto(v.data.datos.data) as object,
      },
      select: { id: true, nombre: true, updatedAt: true },
    });
    return NextResponse.json<ApiResponse>({ success: true, data: creado }, { status: 201 });
  } catch (e) {
    return respuestaErrorBD(e);
  }
}
