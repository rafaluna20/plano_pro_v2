import { Queue } from 'bullmq';
import { redis as connection } from '@/lib/redis/client';

// Cola de generación de planos
// Prefix propio para no colisionar con otras apps que compartan esta instancia de Redis
export const planosQueue = new Queue('planos-generation', {
  connection,
  prefix: 'planospro',
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
