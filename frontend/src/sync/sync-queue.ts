import { db, SyncQueueItem } from '@/db/local.db';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';

const MAX_ATTEMPTS = 5;

// Process all pending sync queue items against the live API.
// Called on network reconnect and on app startup.
export async function flushSyncQueue(): Promise<void> {
  const pending = await db.syncQueue
    .where('attempts')
    .below(MAX_ATTEMPTS)
    .toArray();

  for (const item of pending) {
    try {
      await processQueueItem(item);
      await db.syncQueue.delete(item.id!);
      logger.info('[Sync] Item processed', { type: item.type, id: item.id });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      await db.syncQueue.update(item.id!, {
        attempts: item.attempts + 1,
        lastError: error,
      });
      logger.warn('[Sync] Item failed', { type: item.type, attempts: item.attempts + 1, error });
    }
  }
}

async function processQueueItem(item: SyncQueueItem): Promise<void> {
  switch (item.type) {
    case 'CREATE_SALE':
      await api.post('/sales', item.payload);
      break;
    case 'CASH_PAYMENT':
      await api.post('/payments/cash', item.payload);
      break;
    case 'CANCEL_SALE':
      await api.post(`/sales/${(item.payload as { saleId: string }).saleId}/cancel`, {});
      break;
    default:
      throw new Error(`Unknown sync queue type: ${(item as { type: string }).type}`);
  }
}

// Enqueue an operation for deferred sync (used when offline)
export async function enqueue(type: SyncQueueItem['type'], payload: unknown): Promise<void> {
  await db.syncQueue.add({ type, payload, createdAt: new Date().toISOString(), attempts: 0 });
}

// Sync products from server into local IndexedDB
export async function syncProducts(businessId: string): Promise<void> {
  const res = await api.get('/products');
  const products = res.data.data as Array<{
    id: string;
    businessId: string;
    categoryId?: string;
    name: string;
    description?: string;
    sku?: string;
    price: string;
    stockQuantity: number;
    reservedQuantity: number;
    lowStockAlert: number;
    isActive: boolean;
    updatedAt: string;
  }>;

  await db.transaction('rw', db.products, async () => {
    for (const p of products) {
      await db.products.put({ ...p, price: parseFloat(p.price), _synced: true, businessId });
    }
  });
}
