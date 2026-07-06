import { redis } from '@/lib/redis/client';

const WINDOW_SECONDS = 3600; // ventana fija de 1 hora, alineada con "peticiones por hora"

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Cuenta peticiones por apiKeyId en una ventana fija de 1 hora usando Redis.
 * Usa el prefix "planospro" para no chocar con otras apps que compartan la
 * misma instancia de Redis (ver lib/queue/client.ts).
 */
export async function checkRateLimit(apiKeyId: string, limit: number): Promise<RateLimitResult> {
  const bucket = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `planospro:ratelimit:${apiKeyId}:${bucket}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  const resetAt = new Date((bucket + 1) * WINDOW_SECONDS * 1000);

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}
