const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email = 'it@nationwide-paper.com'.toLowerCase();
  const rawPassword = 'Wonder';
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  // Find or create IT department
  let itDept = await prisma.department.findUnique({ where: { name: 'IT' } });
  if (!itDept) {
    itDept = await prisma.department.create({ data: { name: 'IT' } });
  }

  // Upsert user with SUPER_ADMIN role and all access
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      departmentId: itDept.id,
      name: 'IT Nationwide Admin'
    },
    create: {
      email,
      name: 'IT Nationwide Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      departmentId: itDept.id,
      passwordHash
    }
  });

  console.log(`SUCCESS: User ${user.email} updated with role ${user.role} and password set.`);
}

main()
  .catch((e) => {
    console.error('Error setting up admin user:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
