import 'dotenv/config';
import { createApp } from './app';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { startSaleTimeoutJob } from '@/jobs/sale-timeout.job';

async function main(): Promise<void> {
  // Verify DB connection before starting
  await prisma.$connect();
  logger.info('Database connected');

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`Mpesa adapter: ${env.MPESA_ADAPTER}`);
  });

  // Background jobs
  startSaleTimeoutJob();

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down`);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
