import { Request, Response, NextFunction } from 'express';
import { logger } from '@/lib/logger';

// Safaricom's published callback IP ranges (sandbox + production).
// Update this list when Safaricom adds new egress IPs.
// Reference: https://developer.safaricom.co.ke/docs — IP whitelisting section.
const MPESA_ALLOWED_IPS = new Set([
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.100',
  '196.201.214.114',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.213.109',
  '196.201.214.115',
  '196.201.214.98',
]);

/**
 * Middleware: only allow inbound Mpesa callbacks from Safaricom's known IP ranges.
 * In non-production environments the check is skipped so local/sandbox testing works.
 */
export function mpesaIpWhitelist(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Express sets req.ip; strip IPv4-mapped IPv6 prefix (::ffff:) for comparison
  const raw = req.ip ?? req.socket.remoteAddress ?? '';
  const ip = raw.replace(/^::ffff:/, '');

  if (!MPESA_ALLOWED_IPS.has(ip)) {
    logger.warn('[Mpesa] Rejected callback from unlisted IP', { ip });
    // Return Safaricom-style error body so Safaricom retries correctly
    res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
    return;
  }

  next();
}
