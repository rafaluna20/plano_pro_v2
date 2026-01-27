import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { HealthCheckResponse } from '@/types/api';

export async function GET() {
  const startTime = Date.now();
  
  const services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    storage: 'ok' | 'error';
  } = {
    database: 'ok',
    redis: 'ok',
    storage: 'ok',
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    services.database = 'error';
  }

  // Check Redis (opcional)
  // try {
  //   await redis.ping();
  // } catch (error) {
  //   services.redis = 'error';
  // }

  const status: 'ok' | 'degraded' | 'error' = Object.values(services).includes('error') ? 'error' : 'ok';
  
  const response: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    services,
    version: '1.0.0',
    uptime: process.uptime(),
  };

  return NextResponse.json(response, {
    status: status === 'ok' ? 200 : 503,
  });
}
