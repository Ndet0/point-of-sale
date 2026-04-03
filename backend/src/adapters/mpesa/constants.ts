// Single source of truth for the Mpesa callback path.
// Must match the route registered in payment.routes.ts (/api/payments/mpesa/callback).
// Keeping this as a constant prevents the URL registered with Safaricom from drifting
// away from the route actually handled by Express.
export const MPESA_CALLBACK_PATH = '/api/payments/mpesa/callback';
