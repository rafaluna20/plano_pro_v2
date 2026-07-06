import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-keys';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { ApiResponse } from '@/types/api';

type ApiKeyRecord = NonNullable<Awaited<ReturnType<typeof validateApiKey>>>;

export type ApiAuthResult =
  | { ok: true; apiKeyRecord: ApiKeyRecord }
  | { ok: false; response: NextResponse };

function rateLimitHeaders(limit: number, remaining: number, resetAt: Date): HeadersInit {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.floor(resetAt.getTime() / 1000)),
  };
}

/**
 * Autenticación + rate limiting compartidos por todas las rutas que aceptan
 * x-api-key. Centraliza lo que antes estaba duplicado en cada route.ts.
 */
export async function authenticateApiRequest(request: NextRequest): Promise<ApiAuthResult> {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'MISSING_API_KEY', message: 'API key requerida en header X-API-Key' },
        },
        { status: 401 }
      ),
    };
  }

  const apiKeyRecord = await validateApiKey(apiKey);
  if (!apiKeyRecord) {
    return {
      ok: false,
      response: NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { code: 'INVALID_API_KEY', message: 'API key inválida o expirada' },
        },
        { status: 401 }
      ),
    };
  }

  const rate = await checkRateLimit(apiKeyRecord.id, apiKeyRecord.rateLimit);
  if (!rate.allowed) {
    const retryAfterSeconds = Math.max(0, Math.ceil((rate.resetAt.getTime() - Date.now()) / 1000));
    return {
      ok: false,
      response: NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Límite de ${rate.limit} peticiones/hora excedido. Intenta de nuevo más tarde.`,
          },
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders(rate.limit, rate.remaining, rate.resetAt),
            'Retry-After': String(retryAfterSeconds),
          },
        }
      ),
    };
  }

  return { ok: true, apiKeyRecord };
}
