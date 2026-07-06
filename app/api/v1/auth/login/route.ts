import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida')
});

export async function POST(request: NextRequest) {
  try {
    // Parsear y validar el body
    const body = await request.json();
    const validationResult = loginSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de login inválidos',
            details: validationResult.error.issues
          }
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Buscar usuario por email
    const user = await db.user.findUnique({
      where: { email },
      include: {
        apiKeys: {
          where: {
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos'
          }
        },
        { status: 401 }
      );
    }

    // Verificar contraseña
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos'
          }
        },
        { status: 401 }
      );
    }

    // Obtener la API key activa más reciente (o null si no tiene)
    const apiKey = user.apiKeys[0] || null;

    // Generar JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      apiKeyId: apiKey?.id
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            nombre: user.name || '',
            email: user.email,
            empresa: '',
            createdAt: user.createdAt
          },
          token,
          // apiKey.key en BD es un hash bcrypt, no la key en texto plano:
          // el valor real solo se conoce una vez, al crearla (ver /auth/register).
          // No se puede devolver aquí; el cliente debe conservar la key emitida
          // en el registro o generar una nueva vía el endpoint de API keys.
          apiKey: null
        },
        message: 'Login exitoso'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error en login:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al iniciar sesión',
          details: error instanceof Error ? error.message : 'Error desconocido'
        }
      },
      { status: 500 }
    );
  }
}
