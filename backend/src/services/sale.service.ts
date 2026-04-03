import { prisma } from '@/lib/prisma';
import { AppError } from '@/middleware/error.middleware';
import { Decimal } from '@prisma/client/runtime/library';

interface CartItem {
  productId: string;
  quantity: number;
}

interface CreateSaleInput {
  businessId: string;
  userId: string;
  items: CartItem[];
  notes?: string;
  pickupAt?: Date;
}

// HH:mm format as required by settings.pickupWindowEnd
const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Compute sale timeoutAt from business settings
async function computeTimeoutAt(businessId: string, pickupAt?: Date): Promise<Date> {
  const settings = await prisma.businessSettings.findUnique({ where: { businessId } });
  if (!settings) throw new AppError(500, 'Business settings not found');

  if (settings.saleTimeoutMode === 'pickup_window' && settings.pickupWindowEnd) {
    // Validate format before parsing — an invalid value from the DB (e.g. a
    // migration mistake) would silently produce NaN dates otherwise
    if (!HH_MM_REGEX.test(settings.pickupWindowEnd)) {
      throw new AppError(500, 'Invalid pickupWindowEnd in business settings (expected HH:mm)');
    }

    const now = new Date();
    const [hours, minutes] = settings.pickupWindowEnd.split(':').map(Number);

    // Belt-and-suspenders NaN guard in case the regex somehow passes malformed input
    if (isNaN(hours) || isNaN(minutes)) {
      throw new AppError(500, 'pickupWindowEnd produced non-numeric time components');
    }

    const windowEnd = new Date(now);
    windowEnd.setHours(hours, minutes, 0, 0);
    if (windowEnd <= now) windowEnd.setDate(windowEnd.getDate() + 1);
    return windowEnd;
  }

  // "fixed" mode: timeout N minutes from now
  return new Date(Date.now() + settings.saleTimeoutMinutes * 60 * 1000);
}

export class SaleService {
  async create(input: CreateSaleInput) {
    const { businessId, userId, items, notes, pickupAt } = input;

    // Fetch all products in one query for price snapshot and existence validation
    const products = await prisma.product.findMany({
      where: {
        id: { in: items.map((i) => i.productId) },
        businessId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (products.length !== items.length) {
      throw new AppError(400, 'One or more products not found or unavailable');
    }

    // Fetch settings for tax rate and timeout
    const settings = await prisma.businessSettings.findUnique({ where: { businessId } });
    const taxRate = settings?.taxRate ?? new Decimal(0);
    const timeoutAt = await computeTimeoutAt(businessId, pickupAt);

    // Build sale items with price snapshots using the pre-fetched product data
    const saleItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = product.price;
      const total = unitPrice.mul(item.quantity);
      return { productId: item.productId, quantity: item.quantity, unitPrice, total };
    });

    const subtotal = saleItems.reduce((sum, i) => sum.add(i.total), new Decimal(0));
    const tax = subtotal.mul(taxRate);
    const total = subtotal.add(tax);

    // Atomic: validate stock, create sale + items, and reserve stock in one transaction.
    // Moving the stock check inside the transaction closes the TOCTOU window — two
    // concurrent sales for the last unit will have their reads serialised by Postgres
    // row-level locks on the UPDATE, and only one will succeed.
    const sale = await prisma.$transaction(async (tx) => {
      // Validate and reserve stock for each item atomically
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQuantity: true, reservedQuantity: true, name: true },
        });
        if (!product) throw new AppError(400, 'Product not found');

        const available = product.stockQuantity - product.reservedQuantity;
        if (available < item.quantity) {
          throw new AppError(
            409,
            `Insufficient stock for "${product.name}" (available: ${available})`
          );
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { reservedQuantity: { increment: item.quantity } },
        });
      }

      const newSale = await tx.sale.create({
        data: {
          businessId,
          userId,
          status: 'PENDING',
          subtotal,
          tax,
          total,
          notes,
          pickupAt,
          timeoutAt,
          items: {
            create: saleItems,
          },
        },
        include: { items: { include: { product: true } } },
      });

      return newSale;
    });

    return sale;
  }

  async cancel(saleId: string, businessId: string): Promise<void> {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: { items: true },
    });

    if (!sale) throw new AppError(404, 'Sale not found');
    if (sale.status === 'COMPLETED') throw new AppError(400, 'Cannot cancel a completed sale');
    if (sale.status === 'CANCELLED') throw new AppError(400, 'Sale already cancelled');

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id: saleId }, data: { status: 'CANCELLED' } });

      await tx.payment.updateMany({
        where: { saleId, status: 'PENDING' },
        data: { status: 'FAILED', failureReason: 'Sale cancelled' },
      });

      // Release reserved stock
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { reservedQuantity: { decrement: item.quantity } },
        });
      }
    });
  }

  async getById(saleId: string, businessId: string) {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: {
        items: { include: { product: { select: { name: true, sku: true } } } },
        payment: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!sale) throw new AppError(404, 'Sale not found');
    return sale;
  }

  async list(businessId: string, page: number, limit: number) {
    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { payment: true, user: { select: { name: true } } },
      }),
      prisma.sale.count({ where: { businessId } }),
    ]);
    return { sales, total, page, limit };
  }

  async mySales(userId: string, businessId: string, page: number, limit: number) {
    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where: { userId, businessId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { payment: true },
      }),
      prisma.sale.count({ where: { userId, businessId } }),
    ]);
    return { sales, total, page, limit };
  }
}
