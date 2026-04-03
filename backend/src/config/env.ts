import { z } from 'zod';

// Helper: enforce HTTPS in production for URLs that are externally reachable.
// HTTPS is bypassed in dev/test so local development still works without certs.
const httpsInProd = (fieldName: string) =>
  z.string().url().refine(
    (url) => process.env.NODE_ENV !== 'production' || url.startsWith('https://'),
    { message: `${fieldName} must use HTTPS in production` }
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  // FRONTEND_URL is the CORS origin — must be HTTPS in production to prevent
  // mixed-content issues and ensure cookies are sent with Secure flag
  FRONTEND_URL: httpsInProd('FRONTEND_URL').default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  MPESA_ADAPTER: z.enum(['mock', 'live']).default('mock'),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_BUSINESS_SHORT_CODE: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  // Safaricom will only deliver callbacks to HTTPS endpoints in production
  MPESA_CALLBACK_BASE_URL: httpsInProd('MPESA_CALLBACK_BASE_URL').optional(),
  MPESA_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
