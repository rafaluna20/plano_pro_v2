import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/lib/utils/env';

// Conexión Redis
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Cola de generación de planos
export const planosQueue = new Queue('planos-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});
