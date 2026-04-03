import { Router } from 'express';
import { SettingsController } from '@/controllers/settings.controller';
import { authenticate, requireRole } from '@/middleware/auth.middleware';

export const settingsRoutes = Router();
const ctrl = new SettingsController();

settingsRoutes.use(authenticate, requireRole('ADMIN'));

settingsRoutes.get('/', ctrl.get);
settingsRoutes.put('/', ctrl.update);
