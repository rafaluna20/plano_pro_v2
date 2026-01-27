import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/client';
import { env } from '@/lib/utils/env';

const API_KEY_LENGTH = 32;
const SALT_ROUNDS = 10;

/**
 * Genera una nueva API key
 */
export async function generateApiKey(userId: string, name: string) {
  // Generar key aleatoria
  const rawKey = nanoid(API_KEY_LENGTH);
  const fullKey = `${env.API_KEY_PREFIX}${rawKey}`;
  
  // Hashear para almacenamiento
  const hashedKey = await bcrypt.hash(fullKey, SALT_ROUNDS);
  
  // Guardar en DB
  const apiKey = await prisma.apiKey.create({
    data: {
      key: hashedKey,
      name,
      prefix: fullKey.substring(0, 12), // Mostrar solo prefijo
      userId,
      permissions: ['planos:generate', 'planos:read'],
      rateLimit: 100,
      isActive: true
    }
  });

  // Retornar key completa SOLO UNA VEZ
  return {
    id: apiKey.id,
    key: fullKey,
    prefix: apiKey.prefix,
    name: apiKey.name
  };
}

/**
 * Valida una API key
 */
export async function validateApiKey(key: string) {
  // Buscar todas las keys activas
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true
        }
      }
    }
  });

  // Verificar contra cada una (no podemos hacer query directo porque está hasheada)
  for (const apiKey of apiKeys) {
    const isValid = await bcrypt.compare(key, apiKey.key);
    
    if (isValid) {
      // Actualizar last used
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() }
      });
      
      return apiKey;
    }
  }

  return null;
}

/**
 * Revoca una API key
 */
export async function revokeApiKey(keyId: string) {
  return await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: false }
  });
}
