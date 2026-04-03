import { env } from '@/config/env';
import { MpesaAdapter } from './mpesa.adapter';
import { MockMpesaAdapter } from './mock.adapter';
import { LiveMpesaAdapter } from './live.adapter';

// Single instance, swapped by MPESA_ADAPTER env var
export const mpesaAdapter: MpesaAdapter =
  env.MPESA_ADAPTER === 'live' ? new LiveMpesaAdapter() : new MockMpesaAdapter();
