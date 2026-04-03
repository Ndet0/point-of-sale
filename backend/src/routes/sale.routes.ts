import { Router } from 'express';
import { SaleController } from '@/controllers/sale.controller';
import { authenticate, requireRole } from '@/middleware/auth.middleware';

export const saleRoutes = Router();
const ctrl = new SaleController();

saleRoutes.use(authenticate);

saleRoutes.post('/', ctrl.create);                            // Create sale + reserve stock
saleRoutes.get('/', requireRole('ADMIN'), ctrl.list);        // Admin: all sales
saleRoutes.get('/my', ctrl.mySales);                          // Cashier: own sales
saleRoutes.get('/:id', ctrl.getById);
saleRoutes.post('/:id/cancel', ctrl.cancel);                  // Manual cancel
