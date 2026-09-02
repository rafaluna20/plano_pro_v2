import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth/jwt';
import { generateApiKey } from '@/lib/auth/api-keys';

/**
 * Emite una nueva API key para el usuario autenticado por JWT.
 *
 * La API key se guarda hasheada (bcrypt) en BD, así que su valor en texto
 * plano solo se conoce una vez: al crearla en /auth/register. Si el usuario
 * limpia localStorage o inicia sesión en otro dispositivo, /auth/login no
 * puede devolvérsela (ver comentario en ese route.ts) y hasta ahora no
 * existía forma de recuperar el acceso a la API sin volver a registrarse.
 *
 * Deliberadamente NO revoca las keys activas existentes del usuario: esta
 * misma cuenta puede tener una key ya en uso por integraciones externas
 * (otras aplicaciones llamando a esta API), y revocarla aquí rompería esas
 * integraciones en producción sin que el usuario lo pida explícitamente.
 * Este endpoint solo añade una key más, usando la sesión JWT (no la propia
 * API key) como credencial.
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TOKEN', message: 'Requiere sesión activa (Bearer token)' } },
        { status: 401 }
      );
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: error instanceof Error ? error.message : 'Token inválido' } },
        { status: 401 }
      );
    }

    const apiKey = await generateApiKey(payload.userId, 'API Key (Web)');

    return NextResponse.json({
      success: true,
      data: { apiKey: apiKey.key, prefix: apiKey.prefix }
    });
  } catch (error) {
    console.error('Error regenerando API key:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Error al regenerar la API key' } },
      { status: 500 }
    );
  }
}
