import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';
import { errorMiddleware } from '@/middleware/error.middleware';
import { router } from '@/routes';

export function createApp(): express.Application {
  const app = express();

  // ── Security headers
  app.use(helmet());

  // ── CORS
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true, // allow cookies for refresh tokens
    })
  );

  // ── Body parsing
  app.use(express.json());
  app.use(cookieParser());

  // ── Global rate limit (loose — tighten per-route as needed)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // ── Health check (no auth required)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── API routes
  app.use('/api', router);

  // ── Error handler (must be last)
  app.use(errorMiddleware);

  return app;
}
