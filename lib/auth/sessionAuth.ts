import { NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth/jwt';
import { ApiResponse } from '@/types/api';

export type SesionResultado =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Autenticación por la sesión JWT del usuario logueado en la web (la misma que emite
 * /api/v1/auth/login). Las rutas del editor (proyectos guardados) la usan en lugar de
 * x-api-key: se llaman desde el navegador y deben quedar atadas a la persona.
 */
export function autenticarSesion(request: Request): SesionResultado {
  const token = extractTokenFromHeader(request.headers.get('authorization'));
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'NO_AUTENTICADO', message: 'Inicia sesión para continuar.' } },
        { status: 401 },
      ),
    };
  }
  try {
    const { userId } = verifyToken(token);
    if (!userId) throw new Error('sin userId');
    return { ok: true, userId };
  } catch {
    return {
      ok: false,
      response: NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'SESION_INVALIDA', message: 'Sesión inválida o vencida.' } },
        { status: 401 },
      ),
    };
  }
}

/**
 * Traduce un error de base de datos a una respuesta clara. La causa más probable mientras
 * no se aplique la migración es que la tabla todavía no exista (P2021): se dice tal cual,
 * en vez de un 500 genérico.
 */
export function respuestaErrorBD(error: unknown): NextResponse {
  const codigo = (error as { code?: string } | null)?.code;
  if (codigo === 'P2021' || codigo === 'P2022') {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: 'TABLA_NO_CREADA',
          message: 'La base de datos aún no tiene las tablas de proyectos. Falta aplicar la migración (prisma migrate deploy).',
        },
      },
      { status: 503 },
    );
  }
  if (codigo === 'P2003') {
    // La clave foránea del usuario no existe: el token es de un usuario que ya no está.
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: 'SESION_INVALIDA', message: 'Tu usuario ya no existe. Inicia sesión de nuevo.' } },
      { status: 401 },
    );
  }
  console.error('[proyectos] error de base de datos:', codigo ?? (error as Error)?.message);
  return NextResponse.json<ApiResponse>(
    { success: false, error: { code: 'ERROR_INTERNO', message: 'No se pudo completar la operación.' } },
    { status: 500 },
  );
}
