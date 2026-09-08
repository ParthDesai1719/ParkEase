import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  PORT: z.coerce.number().int().positive().default(5000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  JWT_EXPIRES_IN: z.string().min(1).default('7d'),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);
