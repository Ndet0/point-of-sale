import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Runs every minute. Finds PENDING sales whose timeoutAt has passed
// and marks them ABANDONED, releasing reserved stock atomically.
export function startSaleTimeoutJob(): void {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Find all expired PENDING sales
      const expiredSales = await prisma.sale.findMany({
        where: { status: 'PENDING', timeoutAt: { lte: now } },
        include: { items: true },
      });

      if (expiredSales.length === 0) return;

      logger.info(`[SaleTimeout] Processing ${expiredSales.length} expired sale(s)`);

      for (const sale of expiredSales) {
        await prisma.$transaction(async (tx) => {
          // Mark sale as ABANDONED
          await tx.sale.update({
            where: { id: sale.id },
            data: { status: 'ABANDONED' },
          });

          // Mark payment as FAILED if it exists and is still PENDING
          await tx.payment.updateMany({
            where: { saleId: sale.id, status: 'PENDING' },
            data: { status: 'FAILED', failureReason: 'Sale timed out' },
          });

          // Release reserved stock for each item
          for (const item of sale.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { reservedQuantity: { decrement: item.quantity } },
            });
          }
        });

        logger.info(`[SaleTimeout] Sale ${sale.id} marked ABANDONED, stock released`);
      }
    } catch (err) {
      logger.error('[SaleTimeout] Job failed', { err });
    }
  });

  logger.info('[SaleTimeout] Job started (runs every minute)');
}
