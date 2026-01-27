import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { generateToken } from '@/lib/auth/jwt';
import { generateApiKey } from '@/lib/auth/api-keys';
import { z } from 'zod';

const registerSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  empresa: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    // Parsear y validar el body
    const body = await request.json();
    const validationResult = registerSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de registro inválidos',
            details: validationResult.error.issues
          }
        },
        { status: 400 }
      );
    }

    const { nombre, email, password, empresa } = validationResult.data;

    // Validar fortaleza de la contraseña
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'La contraseña no cumple con los requisitos de seguridad',
            details: passwordValidation.errors
          }
        },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const existingUser = await db.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Este email ya está registrado'
          }
        },
        { status: 409 }
      );
    }

    // Hash de la contraseña
    const passwordHash = await hashPassword(password);

    // Crear el usuario
    const user = await db.user.create({
      data: {
        name: nombre,
        email,
        passwordHash
      }
    });

    // Generar API key automáticamente para el usuario
    const apiKey = await generateApiKey(user.id, 'API Key Principal');

    // Generar JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      apiKeyId: apiKey.id
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
          apiKey: apiKey.key
        },
        message: 'Usuario registrado exitosamente'
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error en registro:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al registrar usuario',
          details: error instanceof Error ? error.message : 'Error desconocido'
        }
      },
      { status: 500 }
    );
  }
}
