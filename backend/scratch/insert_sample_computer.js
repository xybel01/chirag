const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Find category for Laptop
  let category = await prisma.category.findUnique({ where: { code: 'LAP' } });
  if (!category) {
    category = await prisma.category.create({ data: { name: 'Laptop', code: 'LAP' } });
  }

  // Create asset tag
  const count = await prisma.asset.count({ where: { categoryId: category.id } });
  const assetTag = `NP-LAP-${String(count + 1).padStart(4, '0')}`;

  const asset = await prisma.asset.create({
    data: {
      assetTag,
      serialNumber: `SN-LAPTOP-${Date.now()}`,
      model: 'ThinkPad X1 Carbon Gen 11',
      manufacturer: 'Lenovo',
      categoryId: category.id,
      status: 'AVAILABLE',
      purchaseDate: new Date(),
      purchasePrice: 1499.99,
      warrantyStart: new Date(),
      warrantyEnd: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000), // 3 years
      ram: '32GB LPDDR5',
      storage: '1TB NVMe PCIe Gen4 SSD',
      cpu: 'Intel Core i7-1370P vPro (14 Cores)',
      notes: 'Premium developer laptop with carbon fiber top cover.',
    }
  });

  console.log('Sample computer asset created successfully:', asset);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
