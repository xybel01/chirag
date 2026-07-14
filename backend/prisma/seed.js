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
  // 1. Seed Asset Categories
  for (const [name, code] of CATEGORIES) {
    await prisma.category.upsert({ where: { code }, update: {}, create: { name, code } });
  }
  
  // 2. Seed Departments
  for (const name of DEPARTMENTS) {
    await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  }
  
  // 3. Seed Locations
  for (const name of LOCATIONS) {
    await prisma.location.upsert({ where: { name }, update: {}, create: { name } });
  }

  const itDept = await prisma.department.findUnique({ where: { name: 'IT' } });
  const hrDept = await prisma.department.findUnique({ where: { name: 'HR' } });
  const accountsDept = await prisma.department.findUnique({ where: { name: 'Accounts' } });
  const salesDept = await prisma.department.findUnique({ where: { name: 'Sales' } });

  const defaultPass = 'ChangeMe!2026';
  const passwordHash = await bcrypt.hash(defaultPass, 12);

  // 4. Seed Target Demo Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nationwide-paper.com' },
    update: { role: 'SUPER_ADMIN' },
    create: {
      email: 'admin@nationwide-paper.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      departmentId: itDept.id,
      passwordHash,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@nationwide-paper.com' },
    update: { role: 'DEPARTMENT_MANAGER' },
    create: {
      email: 'manager@nationwide-paper.com',
      name: 'Department Manager',
      role: 'DEPARTMENT_MANAGER',
      departmentId: salesDept.id,
      passwordHash,
    },
  });

  const technician = await prisma.user.upsert({
    where: { email: 'technician@nationwide-paper.com' },
    update: { role: 'IT_SUPPORT' },
    create: {
      email: 'technician@nationwide-paper.com',
      name: 'IT Support Engineer',
      role: 'IT_SUPPORT',
      departmentId: itDept.id,
      passwordHash,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'employee@nationwide-paper.com' },
    update: { role: 'EMPLOYEE' },
    create: {
      email: 'employee@nationwide-paper.com',
      name: 'Jane Employee',
      role: 'EMPLOYEE',
      departmentId: salesDept.id,
      passwordHash,
    },
  });

  // 5. Seed default SLAs
  const slas = [
    { name: 'Critical Priority SLA', priority: 'CRITICAL', type: 'INCIDENT', responseTimeMins: 15, resolutionTimeMins: 240 },
    { name: 'High Priority SLA', priority: 'HIGH', type: 'INCIDENT', responseTimeMins: 30, resolutionTimeMins: 480 },
    { name: 'Medium Priority SLA', priority: 'MEDIUM', type: 'INCIDENT', responseTimeMins: 120, resolutionTimeMins: 2880 },
    { name: 'Low Priority SLA', priority: 'LOW', type: 'INCIDENT', responseTimeMins: 240, resolutionTimeMins: 7200 },
  ];
  for (const s of slas) {
    await prisma.sLA.create({ data: s });
  }

  // 6. Seed Knowledge Base articles
  const articles = [
    {
      title: 'How to Connect to Nationwide VPN',
      category: 'VPN Access',
      content: 'Nationwide Paper Ltd uses FortiClient SSL-VPN. Open FortiClient, select SSL-VPN, set portal gateway to vpn.nationwide-paper.com, and log in using your Microsoft 365 credentials.',
      status: 'PUBLISHED',
      authorId: technician.id,
    },
    {
      title: 'Adding Shared Mailbox in Outlook',
      category: 'Microsoft 365',
      content: 'Shared mailboxes are mapped automatically to authorized users. If it does not appear, open Outlook, go to File > Account Settings > Change > More Settings > Advanced > Add, and type the mailbox email.',
      status: 'PUBLISHED',
      authorId: technician.id,
    },
    {
      title: 'Password Reset Self Service',
      category: 'Access Control',
      content: 'You can reset your domain password directly at selfservice.nationwide-paper.com. Authenticate using your Microsoft Authenticator mobile push code.',
      status: 'PUBLISHED',
      authorId: technician.id,
    },
  ];
  for (const a of articles) {
    await prisma.knowledgeArticle.create({ data: a });
  }

  // 7. Seed Custom Fields
  const fields = [
    { name: 'M365 License Type Required', fieldType: 'SELECT', options: JSON.stringify(['Business Premium', 'E3', 'E5']) },
    { name: 'Affected Server Hostname', fieldType: 'TEXT' },
  ];
  for (const f of fields) {
    await prisma.customField.create({ data: f });
  }

  // 8. Seed sample tickets
  await prisma.ticket.create({
    data: {
      ticketNo: 'INC-000001',
      type: 'INCIDENT',
      summary: 'Sales SQL database backup failure',
      description: 'The automated nightly backup job for SQL Database failed with an out-of-storage error.',
      priority: 'CRITICAL',
      status: 'OPEN',
      requesterId: manager.id,
      affectedUserId: manager.id,
      departmentId: salesDept.id,
      assignedToId: technician.id,
      slaStatus: 'WITHIN_SLA',
      slaResolutionExpiry: new Date(Date.now() + 4 * 3600 * 1000), // 4 hours from now
    }
  });

  await prisma.ticket.create({
    data: {
      ticketNo: 'SR-000001',
      type: 'SERVICE_REQUEST',
      summary: 'Requesting Adobe Acrobat Pro installation',
      description: 'Need Acrobat Pro to modify and sign customer sales contracts.',
      priority: 'MEDIUM',
      status: 'PENDING_APPROVAL',
      requesterId: employee.id,
      affectedUserId: employee.id,
      departmentId: salesDept.id,
      slaStatus: 'WITHIN_SLA',
      slaResolutionExpiry: new Date(Date.now() + 48 * 3600 * 1000), // 48 hours from now
    }
  });

  console.log('Seed completed successfully.');
  console.log('User logins (password for all: ChangeMe!2026):');
  console.log(' - Admin: admin@nationwide-paper.com');
  console.log(' - Manager: manager@nationwide-paper.com');
  console.log(' - Support: technician@nationwide-paper.com');
  console.log(' - Employee: employee@nationwide-paper.com');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
