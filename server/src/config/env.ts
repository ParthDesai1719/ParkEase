import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  PORT: z.coerce.number().int().positive().default(5000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  JWT_EXPIRES_IN: z.string().min(1).default('7d'),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  RAZORPAY_KEY_ID: z.string().default(''),

  RAZORPAY_KEY_SECRET: z.string().default(''),

  // Email / SMTP Configuration
  SMTP_HOST: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().optional(),
  ),

  SMTP_PORT: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.coerce.number().int().positive().default(587),
  ),

  SMTP_SECURE: z.preprocess(
    (val) =>
      val === 'true' || val === true ? true : val === 'false' || val === false ? false : undefined,
    z.boolean().optional(),
  ),

  SMTP_USER: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().optional(),
  ),

  SMTP_PASS: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().optional(),
  ),

  SMTP_FROM_EMAIL: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : 'no-reply@parkease.com'),
    z.string().email().default('no-reply@parkease.com'),
  ),

  SMTP_FROM_NAME: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : 'ParkEase'),
    z.string().default('ParkEase'),
  ),

  // Mailpit local development executable path (optional)
  MAILPIT_PATH: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().optional(),
  ),
});

export const env = envSchema.parse(process.env);
