import { Router } from 'express';
import { ProductController } from '@/controllers/product.controller';
import { authenticate, requireRole } from '@/middleware/auth.middleware';

export const productRoutes = Router();
const ctrl = new ProductController();

productRoutes.use(authenticate);

productRoutes.get('/', ctrl.list);
productRoutes.get('/:id', ctrl.getById);
productRoutes.post('/', requireRole('ADMIN'), ctrl.create);
productRoutes.put('/:id', requireRole('ADMIN'), ctrl.update);
productRoutes.delete('/:id', requireRole('ADMIN'), ctrl.softDelete);
