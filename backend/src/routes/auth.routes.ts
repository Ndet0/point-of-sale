import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '@/controllers/auth.controller';
import { authenticate } from '@/middleware/auth.middleware';

export const authRoutes = Router();
const ctrl = new AuthController();

// Stricter rate limit on credential endpoints to slow brute-force attacks.
// 20 req / 15 min is tight enough to deter automated attacks while allowing
// legitimate users who mistype their password a few times.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

authRoutes.post('/register', authLimiter, ctrl.register);  // Register new business + admin user
authRoutes.post('/login', authLimiter, ctrl.login);
authRoutes.post('/refresh', ctrl.refresh);
authRoutes.post('/logout', authenticate, ctrl.logout);
authRoutes.get('/me', authenticate, ctrl.me);
