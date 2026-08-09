import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.challanItem.deleteMany();
  await prisma.challan.deleteMany();
  await prisma.stockMovementLog.deleteMany();
  await prisma.customerFollowup.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // ─── Seed Users (all 4 roles) ─────────────────
  const salt = await bcrypt.genSalt(10);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@erp.com',
      passwordHash: await bcrypt.hash('admin123', salt),
      role: 'Admin',
    },
  });

  const sales = await prisma.user.create({
    data: {
      name: 'Sales User',
      email: 'sales@erp.com',
      passwordHash: await bcrypt.hash('sales123', salt),
      role: 'Sales',
    },
  });

  const warehouse = await prisma.user.create({
    data: {
      name: 'Warehouse User',
      email: 'warehouse@erp.com',
      passwordHash: await bcrypt.hash('warehouse123', salt),
      role: 'Warehouse',
    },
  });

  const accounts = await prisma.user.create({
    data: {
      name: 'Accounts User',
      email: 'accounts@erp.com',
      passwordHash: await bcrypt.hash('accounts123', salt),
      role: 'Accounts',
    },
  });

  console.log('✅ Users seeded');

  // ─── Seed Customers ────────────────────────────
  const customer1 = await prisma.customer.create({
    data: {
      customerName: 'Rajesh Traders',
      mobileNumber: '9876543210',
      email: 'rajesh@traders.com',
      businessName: 'Rajesh Traders Pvt Ltd',
      gstNumber: '27AAPFU0939F1ZV',
      customerType: 'Wholesale',
      address: '123 Market Road, Mumbai, Maharashtra 400001',
      status: 'Active',
      followUpDate: new Date('2026-09-01'),
      notes: 'Key wholesale customer. Prefers bulk orders.',
      createdBy: admin.id,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      customerName: 'Sunita Retail Store',
      mobileNumber: '9123456789',
      email: 'sunita@retail.com',
      businessName: 'Sunita Store',
      gstNumber: null, // optional
      customerType: 'Retail',
      address: '456 Gandhi Nagar, Delhi 110001',
      status: 'Lead',
      followUpDate: new Date('2026-08-20'),
      notes: 'Potential new customer. Follow up after demo.',
      createdBy: sales.id,
    },
  });

  const customer3 = await prisma.customer.create({
    data: {
      customerName: 'Metro Distributors',
      mobileNumber: '9988776655',
      email: 'metro@dist.com',
      businessName: 'Metro Distribution Co.',
      gstNumber: '29AAPFU0939F1ZW',
      customerType: 'Distributor',
      address: '789 Industrial Area, Bangalore 560001',
      status: 'Active',
      followUpDate: null,
      notes: null,
      createdBy: admin.id,
    },
  });

  // ─── Seed Follow-ups ────────────────────────────
  await prisma.customerFollowup.create({
    data: {
      customerId: customer1.id,
      note: 'Called and confirmed next order for October.',
      followUpDate: new Date('2026-08-15'),
      createdBy: sales.id,
    },
  });

  await prisma.customerFollowup.create({
    data: {
      customerId: customer2.id,
      note: 'Sent product catalog via email. Waiting for response.',
      followUpDate: new Date('2026-08-18'),
      createdBy: sales.id,
    },
  });

  console.log('✅ Customers seeded');

  // ─── Seed Products ─────────────────────────────
  const product1 = await prisma.product.create({
    data: {
      productName: 'Basmati Rice 25kg',
      sku: 'RICE-BAS-25',
      category: 'Grains & Cereals',
      unitPrice: 1800.00,
      currentStock: 150,
      minStockAlertQty: 20,
      locationWarehouse: 'Warehouse A - Row 1',
      createdBy: warehouse.id,
    },
  });

  const product2 = await prisma.product.create({
    data: {
      productName: 'Refined Sunflower Oil 15L',
      sku: 'OIL-SUN-15',
      category: 'Oils & Fats',
      unitPrice: 2200.00,
      currentStock: 80,
      minStockAlertQty: 15,
      locationWarehouse: 'Warehouse A - Row 5',
      createdBy: warehouse.id,
    },
  });

  const product3 = await prisma.product.create({
    data: {
      productName: 'Toor Dal 50kg',
      sku: 'DAL-TOOR-50',
      category: 'Pulses',
      unitPrice: 6500.00,
      currentStock: 8, // Below min stock alert — intentionally low
      minStockAlertQty: 10,
      locationWarehouse: 'Warehouse B - Row 2',
      createdBy: warehouse.id,
    },
  });

  const product4 = await prisma.product.create({
    data: {
      productName: 'Sugar 50kg',
      sku: 'SUGAR-50',
      category: 'Sugar & Sweeteners',
      unitPrice: 2100.00,
      currentStock: 200,
      minStockAlertQty: 25,
      locationWarehouse: 'Warehouse A - Row 3',
      createdBy: admin.id,
    },
  });

  // ─── Seed Stock Movement Logs ──────────────────
  await prisma.stockMovementLog.createMany({
    data: [
      {
        productId: product1.id,
        quantityChanged: 150,
        movementType: 'IN',
        reason: 'Initial stock on product creation',
        createdBy: warehouse.id,
      },
      {
        productId: product2.id,
        quantityChanged: 80,
        movementType: 'IN',
        reason: 'Initial stock on product creation',
        createdBy: warehouse.id,
      },
      {
        productId: product3.id,
        quantityChanged: 8,
        movementType: 'IN',
        reason: 'Initial stock on product creation',
        createdBy: warehouse.id,
      },
      {
        productId: product4.id,
        quantityChanged: 200,
        movementType: 'IN',
        reason: 'Initial stock on product creation',
        createdBy: admin.id,
      },
    ],
  });

  console.log('✅ Products & stock logs seeded');

  // ─── Seed Challans ─────────────────────────────
  const challan1 = await prisma.challan.create({
    data: {
      challanNumber: 'CHN-20260809-00001',
      customerId: customer1.id,
      totalQuantity: 15,
      status: 'Confirmed',
      createdBy: sales.id,
      items: {
        create: [
          {
            productId: product1.id,
            productNameSnapshot: 'Basmati Rice 25kg',
            skuSnapshot: 'RICE-BAS-25',
            unitPriceSnapshot: 1800.00,
            quantity: 10,
          },
          {
            productId: product2.id,
            productNameSnapshot: 'Refined Sunflower Oil 15L',
            skuSnapshot: 'OIL-SUN-15',
            unitPriceSnapshot: 2200.00,
            quantity: 5,
          },
        ],
      },
    },
  });

  // Deduct stock for confirmed challan
  await prisma.product.update({ where: { id: product1.id }, data: { currentStock: { decrement: 10 } } });
  await prisma.product.update({ where: { id: product2.id }, data: { currentStock: { decrement: 5 } } });
  await prisma.stockMovementLog.createMany({
    data: [
      { productId: product1.id, quantityChanged: 10, movementType: 'OUT', reason: 'Challan CHN-20260809-00001 confirmed', createdBy: sales.id },
      { productId: product2.id, quantityChanged: 5, movementType: 'OUT', reason: 'Challan CHN-20260809-00001 confirmed', createdBy: sales.id },
    ],
  });

  await prisma.challan.create({
    data: {
      challanNumber: 'CHN-20260809-00002',
      customerId: customer3.id,
      totalQuantity: 5,
      status: 'Draft',
      createdBy: sales.id,
      items: {
        create: [
          {
            productId: product4.id,
            productNameSnapshot: 'Sugar 50kg',
            skuSnapshot: 'SUGAR-50',
            unitPriceSnapshot: 2100.00,
            quantity: 5,
          },
        ],
      },
    },
  });

  console.log('✅ Challans seeded');

  console.log('\n🎉 Database seeded successfully!\n');
  console.log('Test credentials:');
  console.log('  Admin:     admin@erp.com     / admin123');
  console.log('  Sales:     sales@erp.com     / sales123');
  console.log('  Warehouse: warehouse@erp.com / warehouse123');
  console.log('  Accounts:  accounts@erp.com  / accounts123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
