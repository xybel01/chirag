const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.category.count();
  const list = await prisma.category.findMany();
  console.log('Categories count:', count);
  console.log('Categories list:', list);
}

check().finally(() => prisma.$disconnect());
