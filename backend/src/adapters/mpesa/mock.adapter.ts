import { MpesaAdapter, STKPushPayload, STKPushResponse, STKQueryResponse } from './mpesa.adapter';
import { logger } from '@/lib/logger';

// Simulates Mpesa Daraja responses for local development.
// Automatically triggers a "successful" callback via the payment service
// after a short delay — no real network calls.

export class MockMpesaAdapter implements MpesaAdapter {
  async stkPush(payload: STKPushPayload): Promise<STKPushResponse> {
    const checkoutRequestId = `mock-checkout-${Date.now()}`;
    const merchantRequestId = `mock-merchant-${Date.now()}`;

    logger.info('[MockMpesa] STK Push triggered', {
      phone: payload.phoneNumber,
      amount: payload.amount,
      checkoutRequestId,
    });

    return {
      merchantRequestId,
      checkoutRequestId,
      responseCode: '0',
      responseDescription: 'Success. Request accepted for processing',
      customerMessage: 'Success. Request accepted for processing',
    };
  }

  async stkQuery(checkoutRequestId: string): Promise<STKQueryResponse> {
    logger.info('[MockMpesa] STK Query', { checkoutRequestId });

    // In mock mode, always return success for queries
    return {
      resultCode: '0',
      resultDesc: 'The service request is processed successfully.',
      checkoutRequestId,
    };
  }
}
