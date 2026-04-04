import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { SaleService } from '@/services/sale.service';
import { AuthRequest } from '@/types';

const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  notes: z.string().optional(),
  pickupAt: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
});

const service = new SaleService();

export class SaleController {
  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = createSaleSchema.parse(req.body);
      const sale = await service.create({
        businessId: req.user.businessId,
        userId: req.user.id,
        ...input,
      });
      res.status(201).json({ success: true, data: sale });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sale = await service.getById(req.params.id as string, req.user.businessId);
      res.json({ success: true, data: sale });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const result = await service.list(req.user.businessId, page, limit);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  mySales = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const result = await service.mySales(req.user.id, req.user.businessId, page, limit);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await service.cancel(req.params.id as string, req.user.businessId);
      res.json({ success: true, message: 'Sale cancelled' });
    } catch (err) {
      next(err);
    }
  };
}
