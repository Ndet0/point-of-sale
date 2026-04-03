// ─── Mpesa Adapter Interface ──────────────────────────────────────────────────
// Swap between mock (dev) and live (production) via MPESA_ADAPTER env var.
// Both adapters implement this interface identically.

export interface STKPushPayload {
  phoneNumber: string; // format: 254XXXXXXXXX
  amount: number;      // integer KES
  accountReference: string;
  transactionDesc: string;
}

export interface STKPushResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface STKQueryResponse {
  resultCode: string;   // "0" = success, "1032" = cancelled, "1037" = timeout
  resultDesc: string;
  checkoutRequestId: string;
}

export interface MpesaCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;   // 0 = success
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value?: string | number }>;
      };
    };
  };
}

export interface MpesaAdapter {
  stkPush(payload: STKPushPayload): Promise<STKPushResponse>;
  stkQuery(checkoutRequestId: string): Promise<STKQueryResponse>;
}
