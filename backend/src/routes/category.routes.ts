import { Router } from 'express';
import { CategoryController } from '@/controllers/category.controller';
import { authenticate, requireRole } from '@/middleware/auth.middleware';

export const categoryRoutes = Router();
const ctrl = new CategoryController();

categoryRoutes.use(authenticate);

categoryRoutes.get('/', ctrl.list);
categoryRoutes.post('/', requireRole('ADMIN'), ctrl.create);
categoryRoutes.put('/:id', requireRole('ADMIN'), ctrl.update);
categoryRoutes.delete('/:id', requireRole('ADMIN'), ctrl.remove);
