import Dexie, { type EntityTable } from 'dexie';

// ─── Local schema mirrors the backend for offline-first support ───────────────

export interface LocalProduct {
  id: string;
  businessId: string;
  categoryId?: string;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  stockQuantity: number;
  reservedQuantity: number;
  lowStockAlert: number;
  isActive: boolean;
  updatedAt: string; // ISO string for sync comparison
  _synced: boolean;  // true = confirmed with server
}

export interface LocalCartItem {
  id: string;         // uuid generated client-side
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

export interface SyncQueueItem {
  id?: number;        // auto-increment
  type: 'CREATE_SALE' | 'CASH_PAYMENT' | 'CANCEL_SALE';
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

class POSDatabase extends Dexie {
  products!: EntityTable<LocalProduct, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('pos_db');
    this.version(1).stores({
      products: 'id, businessId, categoryId, name, isActive, _synced',
      syncQueue: '++id, type, createdAt, attempts',
    });
  }
}

export const db = new POSDatabase();
