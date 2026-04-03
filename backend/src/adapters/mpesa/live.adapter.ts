import { MpesaAdapter, STKPushPayload, STKPushResponse, STKQueryResponse } from './mpesa.adapter';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { AppError } from '@/middleware/error.middleware';
import { MPESA_CALLBACK_PATH } from './constants';

const BASE_URL =
  env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) throw new AppError(502, 'Failed to get Mpesa access token');
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function getPassword(): { password: string; timestamp: string } {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14);
  const raw = `${env.MPESA_BUSINESS_SHORT_CODE}${env.MPESA_PASSKEY}${timestamp}`;
  return {
    password: Buffer.from(raw).toString('base64'),
    timestamp,
  };
}

export class LiveMpesaAdapter implements MpesaAdapter {
  async stkPush(payload: STKPushPayload): Promise<STKPushResponse> {
    const token = await getAccessToken();
    const { password, timestamp } = getPassword();

    const body = {
      BusinessShortCode: env.MPESA_BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: payload.amount,
      PartyA: payload.phoneNumber,
      PartyB: env.MPESA_BUSINESS_SHORT_CODE,
      PhoneNumber: payload.phoneNumber,
      // MPESA_CALLBACK_PATH is the single source of truth — matches the Express route
      CallBackURL: `${env.MPESA_CALLBACK_BASE_URL}${MPESA_CALLBACK_PATH}`,
      AccountReference: payload.accountReference,
      TransactionDesc: payload.transactionDesc,
    };

    logger.info('[LiveMpesa] STK Push', { phone: payload.phoneNumber, amount: payload.amount });

    const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error('[LiveMpesa] STK Push failed', { err });
      throw new AppError(502, 'Mpesa STK Push failed');
    }

    const data = (await res.json()) as {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResponseCode: string;
      ResponseDescription: string;
      CustomerMessage: string;
    };

    return {
      merchantRequestId: data.MerchantRequestID,
      checkoutRequestId: data.CheckoutRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      customerMessage: data.CustomerMessage,
    };
  }

  async stkQuery(checkoutRequestId: string): Promise<STKQueryResponse> {
    const token = await getAccessToken();
    const { password, timestamp } = getPassword();

    const body = {
      BusinessShortCode: env.MPESA_BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    const res = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new AppError(502, 'Mpesa STK Query failed');

    const data = (await res.json()) as {
      ResultCode: string;
      ResultDesc: string;
      CheckoutRequestID: string;
    };

    return {
      resultCode: data.ResultCode,
      resultDesc: data.ResultDesc,
      checkoutRequestId: data.CheckoutRequestID,
    };
  }
}
