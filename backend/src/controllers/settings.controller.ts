import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthRequest } from '@/types';

const settingsSchema = z.object({
  saleTimeoutMode: z.enum(['fixed', 'pickup_window']).optional(),
  saleTimeoutMinutes: z.number().int().min(1).max(1440).optional(),
  pickupWindowStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  pickupWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  allowManualPaymentOverride: z.boolean().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  currency: z.string().length(3).optional(),
});

export class SettingsController {
  get = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await prisma.businessSettings.findUnique({
        where: { businessId: req.user.businessId },
      });
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = settingsSchema.parse(req.body);
      const settings = await prisma.businessSettings.update({
        where: { businessId: req.user.businessId },
        data,
      });
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  };
}
