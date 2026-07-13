const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const CATEGORIES = [
  ['Laptop', 'LAP'], ['Desktop', 'DSK'], ['Monitor', 'MON'], ['Printer', 'PRN'],
  ['Firewall', 'FWL'], ['Router', 'RTR'], ['Switch', 'SWT'], ['Access Point', 'WAP'],
  ['Mobile', 'MOB'], ['Keyboard', 'KBD'], ['Mouse', 'MOU'], ['RAM', 'RAM'],
  ['SSD', 'SSD'], ['UPS', 'UPS'], ['CCTV', 'CCT'], ['Biometric Device', 'BIO'],
  ['Software License', 'SWL'],
];
const DEPARTMENTS = ['IT', 'HR', 'Accounts', 'Sales', 'Operations', 'Warehouse', 'Management'];
const LOCATIONS = ['Head Office', 'Warehouse 1', 'Warehouse 2', 'Branch Office'];

async function main() {
  for (const [name, code] of CATEGORIES) {
    await prisma.category.upsert({ where: { code }, update: {}, create: { name, code } });
  }
  for (const name of DEPARTMENTS) {
    await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of LOCATIONS) {
    await prisma.location.upsert({ where: { name }, update: {}, create: { name } });
  }
  const itDept = await prisma.department.findUnique({ where: { name: 'IT' } });
  const adminPass = process.env.ADMIN_PASSWORD || 'ChangeMe!2026';
  await prisma.user.upsert({
    where: { email: 'admin@nationwide-paper.com' },
    update: {},
    create: {
      email: 'admin@nationwide-paper.com',
      name: 'System Administrator',
      role: 'ADMIN',
      departmentId: itDept.id,
      passwordHash: await bcrypt.hash(adminPass, 12),
    },
  });
  console.log('Seed complete. Admin login: admin@nationwide-paper.com /', adminPass);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
