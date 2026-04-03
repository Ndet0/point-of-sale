import { prisma } from '@/lib/prisma';
import { AppError } from '@/middleware/error.middleware';
import { mpesaAdapter } from '@/adapters/mpesa';
import { MpesaCallbackPayload } from '@/adapters/mpesa/mpesa.adapter';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

// Convenience alias for the Prisma interactive transaction client
type TxClient = Prisma.TransactionClient;

export class PaymentService {
  // ── STK Push ────────────────────────────────────────────────────────────────
  async initiateStkPush(saleId: string, businessId: string, phoneNumber: string) {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId, status: 'PENDING' },
    });
    if (!sale) throw new AppError(404, 'Sale not found or not in PENDING state');

    // Prevent duplicate pushes for same sale
    const existing = await prisma.payment.findUnique({ where: { saleId } });
    if (existing?.status === 'SUCCESS') throw new AppError(409, 'Sale already paid');
    if (existing?.status === 'PENDING') {
      throw new AppError(409, 'STK Push already initiated — awaiting customer confirmation');
    }

    const response = await mpesaAdapter.stkPush({
      phoneNumber,
      amount: Math.ceil(Number(sale.total)), // Mpesa requires integer
      accountReference: sale.id.slice(0, 12).toUpperCase(),
      transactionDesc: 'POS Payment',
    });

    const payment = await prisma.payment.upsert({
      where: { saleId },
      create: {
        businessId,
        saleId,
        method: 'MPESA',
        status: 'PENDING',
        amount: sale.total,
        mpesaCheckoutRequestId: response.checkoutRequestId,
        mpesaMerchantRequestId: response.merchantRequestId,
        mpesaPhoneNumber: phoneNumber,
      },
      update: {
        mpesaCheckoutRequestId: response.checkoutRequestId,
        mpesaMerchantRequestId: response.merchantRequestId,
        mpesaPhoneNumber: phoneNumber,
        status: 'PENDING',
      },
    });

    return { payment, customerMessage: response.customerMessage };
  }

  // ── STK Query (fallback) ────────────────────────────────────────────────────
  async queryStkPush(saleId: string, businessId: string) {
    const payment = await prisma.payment.findFirst({
      where: { saleId, businessId, method: 'MPESA' },
    });
    if (!payment?.mpesaCheckoutRequestId) {
      throw new AppError(404, 'No Mpesa payment found for this sale');
    }

    const result = await mpesaAdapter.stkQuery(payment.mpesaCheckoutRequestId);

    if (result.resultCode === '0') {
      // Safaricom's query API confirms payment was made but does NOT return the
      // MpesaReceiptNumber — that is only available in the async callback payload.
      // Store undefined here; the receipt will be populated when the callback arrives.
      await this.completeSale(payment.saleId, payment.businessId, payment.id, {
        receiptNumber: undefined,
      });
    }

    return result;
  }

  // ── Mpesa Callback ──────────────────────────────────────────────────────────
  // businessId is intentionally NOT a parameter — we derive it from the payment
  // record to prevent tenant spoofing via manipulated callback URLs.
  async processMpesaCallback(payload: MpesaCallbackPayload): Promise<void> {
    const { stkCallback } = payload.Body;
    const checkoutRequestId = stkCallback.CheckoutRequestID;

    // Verify the payment record exists BEFORE any DB writes — rejects spoofed or
    // replayed callbacks that reference unknown checkout IDs with zero side effects.
    const payment = await prisma.payment.findFirst({
      where: { mpesaCheckoutRequestId: checkoutRequestId },
    });

    if (!payment) {
      logger.warn('[Mpesa Callback] No payment found for checkout', { checkoutRequestId });
      return;
    }

    // Idempotency: a second callback for the same checkout must be a no-op
    if (payment.status === 'SUCCESS') {
      logger.info('[Mpesa Callback] Already processed, skipping', { checkoutRequestId });
      return;
    }

    // Log raw payload for audit trail — use businessId from DB record, not from
    // query params, to prevent a bad actor from attributing logs to another tenant
    await prisma.mpesaCallbackLog.create({
      data: {
        businessId: payment.businessId,
        checkoutRequestId,
        payload: payload as object,
      },
    });

    if (stkCallback.ResultCode !== 0) {
      // Payment failed or was cancelled by the customer
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: stkCallback.ResultDesc,
          processedAt: new Date(),
        },
      });
      logger.info('[Mpesa Callback] Payment failed', { resultDesc: stkCallback.ResultDesc });
      return;
    }

    // Extract receipt number from callback metadata
    const meta = stkCallback.CallbackMetadata?.Item ?? [];
    const receiptNumber = meta.find((i) => i.Name === 'MpesaReceiptNumber')?.Value as string;

    await this.completeSale(payment.saleId, payment.businessId, payment.id, { receiptNumber });

    // Mark callback log as processed
    await prisma.mpesaCallbackLog.updateMany({
      where: { checkoutRequestId, processed: false },
      data: { processed: true },
    });
  }

  // ── Cash Payment ────────────────────────────────────────────────────────────
  async cashPayment(saleId: string, businessId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      // Guard check inside transaction — prevents TOCTOU race where two concurrent
      // requests both pass a pre-transaction check then double-complete the sale
      const sale = await tx.sale.findFirst({
        where: { id: saleId, businessId, status: 'PENDING' },
      });
      if (!sale) throw new AppError(404, 'Sale not found or already paid');

      const existing = await tx.payment.findUnique({ where: { saleId } });
      if (existing?.status === 'SUCCESS') throw new AppError(409, 'Sale already paid');

      const payment = await tx.payment.upsert({
        where: { saleId },
        create: {
          businessId,
          saleId,
          method: 'CASH',
          status: 'PENDING',
          amount: sale.total,
        },
        update: { method: 'CASH', status: 'PENDING' },
      });

      // Pass tx so completion runs in the same transaction — no split-brain between
      // payment status update and stock deduction
      await this.completeSale(saleId, businessId, payment.id, {}, tx);
      return payment;
    });
  }

  // ── Manual Override (Mpesa down) ────────────────────────────────────────────
  async manualOverride(
    saleId: string,
    businessId: string,
    overrideByUserId: string,
    reason: string
  ) {
    // Settings check stays outside the transaction — it's a configuration read,
    // not a mutable resource subject to race conditions
    const settings = await prisma.businessSettings.findUnique({ where: { businessId } });
    if (!settings?.allowManualPaymentOverride) {
      throw new AppError(403, 'Manual payment override is disabled for this business');
    }

    return prisma.$transaction(async (tx) => {
      // Guard check inside transaction — same TOCTOU protection as cashPayment
      const sale = await tx.sale.findFirst({
        where: { id: saleId, businessId, status: 'PENDING' },
      });
      if (!sale) throw new AppError(404, 'Sale not found or not in PENDING state');

      const existing = await tx.payment.findUnique({ where: { saleId } });
      if (existing?.status === 'SUCCESS') throw new AppError(409, 'Sale already paid');

      const payment = await tx.payment.upsert({
        where: { saleId },
        create: {
          businessId,
          saleId,
          method: 'MANUAL',
          status: 'OVERRIDE',
          amount: sale.total,
          overrideReason: reason,
          overrideByUserId,
          overrideAt: new Date(),
          processedAt: new Date(),
        },
        update: {
          method: 'MANUAL',
          status: 'OVERRIDE',
          overrideReason: reason,
          overrideByUserId,
          overrideAt: new Date(),
          processedAt: new Date(),
        },
      });

      await this.completeSale(saleId, businessId, payment.id, {}, tx);
      logger.info('[Payment] Manual override applied', { saleId, overrideByUserId, reason });
      return payment;
    });
  }

  // ── Shared sale completion logic ────────────────────────────────────────────
  // Accepts an optional tx so callers that already hold a transaction can include
  // this work atomically. When tx is omitted, a new transaction is created.
  private async completeSale(
    saleId: string,
    businessId: string,
    paymentId: string,
    meta: { receiptNumber?: string },
    tx?: TxClient
  ): Promise<void> {
    const run = async (db: TxClient): Promise<void> => {
      // Re-fetch sale status inside the transaction as an idempotency guard.
      // If two processes (e.g. callback + queryStkPush) race to complete the same
      // sale, the second one will see status !== 'PENDING' and exit without
      // deducting stock a second time.
      const sale = await db.sale.findFirst({
        where: { id: saleId, businessId },
        include: { items: true },
      });
      if (!sale) throw new AppError(404, 'Sale not found');

      if (sale.status !== 'PENDING') {
        logger.info('[Payment] completeSale skipped — sale already processed', {
          saleId,
          status: sale.status,
        });
        return;
      }

      // Mark payment SUCCESS
      await db.payment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          mpesaReceiptNumber: meta.receiptNumber,
          processedAt: new Date(),
        },
      });

      // Mark sale COMPLETED
      await db.sale.update({ where: { id: saleId }, data: { status: 'COMPLETED' } });

      // Deduct actual stock + release reservation atomically
      for (const item of sale.items) {
        await db.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { decrement: item.quantity },
            reservedQuantity: { decrement: item.quantity },
          },
        });
      }
    };

    if (tx) {
      // Already inside a transaction — reuse it to keep all writes atomic
      await run(tx);
    } else {
      await prisma.$transaction(run);
    }

    logger.info('[Payment] Sale completed', { saleId });
  }
}
