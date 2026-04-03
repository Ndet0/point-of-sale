import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  const business = await prisma.business.upsert({
    where: { id: 'seed-business-id-0000-000000000001' },
    update: {},
    create: {
      id: 'seed-business-id-0000-000000000001',
      name: 'Demo Cafe',
      email: 'demo@cafe.co.ke',
      phone: '254712345678',
      settings: {
        create: {
          saleTimeoutMode: 'pickup_window',
          pickupWindowStart: '07:00',
          pickupWindowEnd: '21:00',
          allowManualPaymentOverride: true,
          taxRate: 0.16, // 16% VAT
        },
      },
      users: {
        create: [
          {
            name: 'Admin User',
            email: 'admin@cafe.co.ke',
            password: passwordHash,
            role: 'ADMIN',
          },
          {
            name: 'Cashier One',
            email: 'cashier@cafe.co.ke',
            password: passwordHash,
            role: 'CASHIER',
          },
        ],
      },
      categories: {
        create: [
          { name: 'Beverages' },
          { name: 'Pastries' },
          { name: 'Meals' },
        ],
      },
    },
  });

  const categories = await prisma.category.findMany({
    where: { businessId: business.id },
  });

  const beverages = categories.find((c) => c.name === 'Beverages')!;
  const pastries = categories.find((c) => c.name === 'Pastries')!;

  await prisma.product.createMany({
    skipDuplicates: true,
    data: [
      {
        businessId: business.id,
        categoryId: beverages.id,
        name: 'Espresso',
        price: 150,
        stockQuantity: 100,
        sku: 'BEV-001',
      },
      {
        businessId: business.id,
        categoryId: beverages.id,
        name: 'Cappuccino',
        price: 250,
        stockQuantity: 100,
        sku: 'BEV-002',
      },
      {
        businessId: business.id,
        categoryId: pastries.id,
        name: 'Croissant',
        price: 180,
        stockQuantity: 30,
        sku: 'PAS-001',
      },
      {
        businessId: business.id,
        categoryId: pastries.id,
        name: 'Blueberry Muffin',
        price: 200,
        stockQuantity: 20,
        sku: 'PAS-002',
        lowStockAlert: 5,
      },
    ],
  });

  console.log('Seed complete.');
  console.log('Business ID:', business.id);
  console.log('Login: admin@cafe.co.ke / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
