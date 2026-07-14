const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const CATEGORIES = [
  ['Desktop', 'DSK'], ['Laptop', 'LAP'], ['Workstation', 'WKS'], ['Mini PC', 'MPC'],
  ['Server', 'SRV'], ['Virtual Server', 'VSRV'], ['NAS', 'NAS'], ['SAN Storage', 'SAN'],
  ['Monitor', 'MON'], ['Printer', 'PRN'], ['Scanner', 'SCN'], ['Plotter', 'PLT'],
  ['Keyboard', 'KBD'], ['Mouse', 'MOU'], ['Headset', 'HDS'], ['Webcam', 'CAM'],
  ['Docking Station', 'DKS'], ['UPS', 'UPS'], ['Switch', 'SWT'], ['Router', 'RTR'],
  ['Firewall', 'FWL'], ['WiFi Access Point', 'WAP'], ['CCTV Camera', 'CTV'],
  ['NVR', 'NVR'], ['DVR', 'DVR'], ['Biometric Device', 'BIO'], ['Mobile', 'MOB'],
  ['Tablet', 'TAB'], ['SIM Card', 'SIM'], ['IP Phone', 'IPP'], ['Conference Device', 'CONF'],
  ['Projector', 'PRJ'], ['TV Display', 'DISP'], ['Barcode Scanner', 'BAR'],
  ['POS Machine', 'POS'], ['Software License', 'SWL'], ['Microsoft 365 License', 'M365'],
  ['Adobe License', 'ADOBE'], ['Antivirus License', 'AVIL'], ['SSL Certificate', 'SSL'],
  ['Domain', 'DOM'], ['Cloud Subscription', 'CLOUD'], ['Azure Resource', 'AZR'],
  ['AWS Resource', 'AWS'], ['Google Workspace', 'GWS'], ['Shared Mailbox', 'SHM'],
  ['Distribution Group', 'DLG']
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
  ];
  for (const a of articles) {
    await prisma.knowledgeArticle.create({ data: a });
  }

  // 7. Seed Consumables stock items
  const locHead = await prisma.location.findUnique({ where: { name: 'Head Office' } });
  const consumables = [
    { name: 'Standard USB Optical Mouse', type: 'ACCESSORY', quantity: 25, minQuantity: 5, unitPrice: 15.00, locationId: locHead.id },
    { name: 'Standard QWERTY USB Keyboard', type: 'ACCESSORY', quantity: 18, minQuantity: 5, unitPrice: 25.00, locationId: locHead.id },
    { name: 'HMDI 4K Cable 2m', type: 'ACCESSORY', quantity: 30, minQuantity: 10, unitPrice: 8.50, locationId: locHead.id },
    { name: 'Cat6 LAN Patch Cable 1m', type: 'ACCESSORY', quantity: 45, minQuantity: 10, unitPrice: 4.50, locationId: locHead.id },
    { name: 'HP LaserJet 58A Toner', type: 'CONSUMABLE', quantity: 3, minQuantity: 5, unitPrice: 110.00, locationId: locHead.id }, // Low stock alert!
  ];
  for (const c of consumables) {
    await prisma.stockItem.create({ data: c });
  }

  // 8. Seed sample computers with expanded CMDB fields
  const categoryLap = await prisma.category.findUnique({ where: { code: 'LAP' } });
  const asset = await prisma.asset.create({
    data: {
      assetTag: 'NPL-LT-0001',
      serialNumber: 'SN-ThinkPad-X1',
      model: 'ThinkPad X1 Carbon Gen 10',
      manufacturer: 'Lenovo',
      categoryId: categoryLap.id,
      status: 'AVAILABLE',
      ram: '16 GB LPDDR5',
      storage: '512GB NVMe SSD',
      cpu: 'Intel Core i7-1260P',
      windowsEdition: 'Windows 11 Professional',
      windowsVersion: '22H2',
      buildNumber: '22621.1702',
      activationStatus: 'Active',
      computerName: 'NPL-LT-0001',
      domainName: 'nationwide-paper.local',
      bitLockerStatus: 'Enabled',
      tpmVersion: '2.0',
      secureBootStatus: 'Enabled',
      defenderStatus: 'Running',
      firewallStatus: 'Enabled',
      nextMaintenance: new Date(Date.now() + 15 * 24 * 3600 * 1000), // in 15 days
    }
  });

  // Seed maintenance record
  await prisma.maintenance.create({
    data: {
      assetId: asset.id,
      maintenanceDate: new Date(Date.now() - 30 * 24 * 3600 * 1000), // 30 days ago
      notes: 'Applied standard processor thermal paste renewal and OS clean reinstallation.',
      performedBy: 'IT Support Engineer',
      cost: 45.00,
      nextDueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      status: 'COMPLETED'
    }
  });

  console.log('Seed completed successfully.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
