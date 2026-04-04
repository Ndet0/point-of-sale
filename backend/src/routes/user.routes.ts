import { Router } from 'express';
import { UserController } from '@/controllers/user.controller';
import { authenticate, requireRole } from '@/middleware/auth.middleware';
import { Role } from '@prisma/client';

export const userRoutes = Router();
const ctrl = new UserController();

// GET /users - List all users (admin only)
userRoutes.get('/', authenticate, requireRole(Role.ADMIN), ctrl.list);
