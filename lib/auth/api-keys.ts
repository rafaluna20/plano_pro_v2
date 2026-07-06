import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/client';
import { env } from '@/lib/utils/env';

const API_KEY_LENGTH = 32;
const SALT_ROUNDS = 10;

// Hash rápido (no bcrypt) para permitir lookup indexado O(1) en DB.
// Es seguro para este caso porque la API key es un token aleatorio de alta
// entropía (nanoid, 32 chars) y no una contraseña elegida por un humano:
// no hay diccionario ni fuerza bruta viable, así que no hace falta un hash
// lento con salt — solo que no sea reversible si roban la base de datos.
function fastHash(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

const activeKeyWhere = {
  isActive: true,
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
};

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
      keyHash: fastHash(fullKey),
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
 * Valida una API key.
 * Camino rápido: lookup indexado por keyHash (O(1)).
 * Camino legacy: si la key no tiene keyHash todavía (emitida antes de esta
 * migración), cae a comparar bcrypt solo contra ese subconjunto, que se
 * reduce a medida que esas keys se regeneran o expiran.
 */
export async function validateApiKey(key: string) {
  const userSelect = {
    user: { select: { id: true, email: true, role: true } },
  } as const;

  const fastMatch = await prisma.apiKey.findFirst({
    where: { keyHash: fastHash(key), ...activeKeyWhere },
    include: userSelect,
  });

  if (fastMatch) {
    await prisma.apiKey.update({
      where: { id: fastMatch.id },
      data: { lastUsedAt: new Date() },
    });
    return fastMatch;
  }

  // Fallback legacy: solo recorre keys que aún no tienen keyHash asignado
  const legacyKeys = await prisma.apiKey.findMany({
    where: { keyHash: null, ...activeKeyWhere },
    include: userSelect,
  });

  for (const apiKey of legacyKeys) {
    const isValid = await bcrypt.compare(key, apiKey.key);

    if (isValid) {
      // Migra la key al camino rápido para que la próxima vez sea O(1)
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date(), keyHash: fastHash(key) },
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
