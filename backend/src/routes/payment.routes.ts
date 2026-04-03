import { Router } from 'express';
import { PaymentController } from '@/controllers/payment.controller';
import { authenticate, requireRole } from '@/middleware/auth.middleware';
import { mpesaIpWhitelist } from '@/middleware/mpesa.middleware';

export const paymentRoutes = Router();
const ctrl = new PaymentController();

// Mpesa callback — no auth (called by Safaricom servers).
// IP whitelist guards against spoofed callbacks from non-Safaricom IPs.
paymentRoutes.post('/mpesa/callback', mpesaIpWhitelist, ctrl.mpesaCallback);

paymentRoutes.use(authenticate);

paymentRoutes.post('/mpesa/push', ctrl.stkPush);     // Initiate STK Push
paymentRoutes.post('/mpesa/query', ctrl.stkQuery);   // Manual fallback query
paymentRoutes.post('/cash', ctrl.cashPayment);        // Cash payment (always available)
// Override requires ADMIN — prevents cashiers from bypassing payment validation
paymentRoutes.post('/override', requireRole('ADMIN'), ctrl.manualOverride);
