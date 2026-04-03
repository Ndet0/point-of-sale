import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { productRoutes } from './product.routes';
import { categoryRoutes } from './category.routes';
import { saleRoutes } from './sale.routes';
import { paymentRoutes } from './payment.routes';
import { settingsRoutes } from './settings.routes';

export const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/sales', saleRoutes);
router.use('/payments', paymentRoutes);
router.use('/settings', settingsRoutes);
