import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PaymentService } from '@/services/payment.service';
import { AuthRequest } from '@/types';

const stkPushSchema = z.object({
  saleId: z.string().uuid(),
  phoneNumber: z.string().regex(/^254\d{9}$/, 'Phone must be in format 254XXXXXXXXX'),
});

const cashSchema = z.object({ saleId: z.string().uuid() });

const overrideSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().min(5, 'Override reason must be at least 5 characters'),
});

const service = new PaymentService();

export class PaymentController {
  stkPush = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { saleId, phoneNumber } = stkPushSchema.parse(req.body);
      const result = await service.initiateStkPush(saleId, req.user.businessId, phoneNumber);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  stkQuery = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { saleId } = z.object({ saleId: z.string().uuid() }).parse(req.body);
      const result = await service.queryStkPush(saleId, req.user.businessId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // Called by Safaricom — no auth middleware, must be fast
  mpesaCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Respond immediately to Safaricom (they require a response within 5s)
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    try {
      // businessId is no longer derived from query params — it comes from the
      // payment record matched by checkoutRequestId, preventing tenant spoofing
      await service.processMpesaCallback(req.body);
    } catch (err) {
      next(err);
    }
  };

  cashPayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { saleId } = cashSchema.parse(req.body);
      const payment = await service.cashPayment(saleId, req.user.businessId, req.user.id);
      res.json({ success: true, data: payment });
    } catch (err) {
      next(err);
    }
  };

  manualOverride = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { saleId, reason } = overrideSchema.parse(req.body);
      const payment = await service.manualOverride(
        saleId,
        req.user.businessId,
        req.user.id,
        reason
      );
      res.json({ success: true, data: payment });
    } catch (err) {
      next(err);
    }
  };
}
