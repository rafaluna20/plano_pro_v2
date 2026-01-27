import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_SECRET: z.string().min(1),
    API_KEY_PREFIX: z.string().default('plpro_'),
    STORAGE_TYPE: z.enum(['local', 'gcs', 'vercel-blob', 's3']).default('local'),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    AWS_REGION: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_S3_BUCKET: z.string().optional(),
    GCS_BUCKET_NAME: z.string().optional(),
    GCS_KEY_FILE: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    API_KEY_PREFIX: process.env.API_KEY_PREFIX,
    STORAGE_TYPE: process.env.STORAGE_TYPE,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
    GCS_KEY_FILE: process.env.GCS_KEY_FILE,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
