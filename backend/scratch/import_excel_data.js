const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

// Standards regexes
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function run() {
  const filePath = path.join(__dirname, '..', '..', 'test mail.xlsx');
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws);

  console.log(`Starting bulk import of ${rows.length} rows from Excel...`);

  let usersCreated = 0;
  let assetsCreated = 0;
  let assetsUpdated = 0;

  // Get default location
  let location = await prisma.location.findFirst();
  if (!location) {
    location = await prisma.location.create({ data: { name: 'Head Office', address: 'Nationwide Paper HQ' } });
  }

  // Clean up previous imports to ensure clean run
  await prisma.assignment.deleteMany({
    where: { notes: { contains: 'Bulk Import' } }
  });
  await prisma.asset.deleteMany({
    where: {
      OR: [
        { assetTag: { startsWith: 'NPL-' } },
        { assetTag: { startsWith: 'IWL-' } },
        { assetTag: { startsWith: 'VSDENT-' } }
      ]
    }
  });

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    // 1. Clean & Extract user email
    const emailField = row['Email ID'];
    if (!emailField || !EMAIL_REGEX.test(String(emailField).trim())) {
      console.warn(`Skipping row due to invalid/missing Email ID:`, row['Name ']);
      continue;
    }
    const email = String(emailField).trim().toLowerCase();

    // 2. Clean Name
    const rawName = row['Name '] || row['Name'] || email.split('@')[0];
    const name = String(rawName).trim();

    // 3. Clean Department
    const deptName = row['Department'] ? String(row['Department']).trim() : 'IT';
    let department = await prisma.department.findUnique({ where: { name: deptName } });
    if (!department) {
      department = await prisma.department.create({ data: { name: deptName } });
    }

    // 4. Create or Update User
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          role: 'EMPLOYEE',
          departmentId: department.id,
          isActive: true
        }
      });
      usersCreated++;
    }

    // 5. Clean Device Specifications
    const rawDevice = row['Desktop / Laptop'] || row['Device Type'] || 'DESKTOP';
    let deviceType = String(rawDevice).trim().toUpperCase();
    if (deviceType.includes('LAPTOP') || deviceType.includes('NOTEBOOK')) {
      deviceType = 'LAPTOP';
    } else {
      deviceType = 'DESKTOP';
    }

    // Category
    const catCode = deviceType === 'LAPTOP' ? 'LAP' : 'DSK';
    const catName = deviceType === 'LAPTOP' ? 'Laptop' : 'Desktop';
    let category = await prisma.category.findUnique({ where: { code: catCode } });
    if (!category) {
      category = await prisma.category.create({ data: { name: catName, code: catCode } });
    }

    // 6. Generate Custom Asset ID Prefix
    const company = String(row['Company Name'] || 'NPL').trim().toUpperCase();
    let companyPrefix = 'VSDENT';
    if (company.includes('NPL') || company.includes('NATIONWIDE')) {
      companyPrefix = 'NPL';
    } else if (company.includes('IWL')) {
      companyPrefix = 'IWL';
    }

    const typeSuffix = deviceType === 'LAPTOP' ? 'LT' : 'DT';
    const tagPrefix = `${companyPrefix}-${typeSuffix}-`;

    // 7. Clean specs
    const hostName = row['Host Name'] ? String(row['Host Name']).trim() : `host-${user.id}`;
    let macAddress = row['MAC Addreess'] || row['MAC Address'] || '';
    macAddress = String(macAddress).replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    if (macAddress.length === 12) {
      macAddress = macAddress.match(/.{1,2}/g).join(':');
    } else {
      macAddress = `00:11:22:33:44:${String(index).padStart(2, '0')}`; // dummy mac
    }

    const ipAddress = row['IP Address'] ? String(row['IP Address']).trim() : null;
    const cpu = row['CPU'] ? String(row['CPU']).trim() : null;
    const hardDrive = row['Hard Drive'] ? String(row['Hard Drive']).trim() : null;
    
    // RAM standardization
    let ram = row['Ram'] || row['RAM'] || null;
    if (ram) {
      const cleanRam = String(ram).replace(/\s*gb\s*/i, '').trim();
      ram = `${cleanRam} GB`;
    }

    // Serial Number uniqueness (we use MAC address or Host Name)
    const serialNumber = macAddress || `SN-${hostName}`;

    // Manufacturer & Model
    const laptopModel = row['Laptop'] ? String(row['Laptop']).trim() : 'Generic';
    const isModelNo = laptopModel.toUpperCase() === 'NO';
    const manufacturer = isModelNo ? (deviceType === 'LAPTOP' ? 'Generic Laptop' : 'Generic Desktop') : laptopModel.split(' ')[0];
    const model = isModelNo ? 'System Model' : laptopModel;

    // Check if asset already exists
    let asset = await prisma.asset.findUnique({
      where: {
        serialNumber
      }
    });

    const remark = row['Remark'] ? String(row['Remark']).trim() : '';
    const formattedNotes = `Host Name: ${hostName}\nMAC Address: ${macAddress}\nIP Address: ${ipAddress || '—'}\nRemark: ${remark || '—'}`;

    const dataObj = {
      model,
      manufacturer,
      categoryId: category.id,
      serialNumber,
      cpu,
      ram,
      storage: hardDrive,
      locationId: location.id,
      departmentId: department.id,
      assignedToId: user.id,
      status: 'ASSIGNED',
      notes: formattedNotes
    };

    if (asset) {
      // Update existing asset
      asset = await prisma.asset.update({
        where: { id: asset.id },
        data: dataObj
      });
      assetsUpdated++;
    } else {
      // Generate new custom tag
      const existingCount = await prisma.asset.count({
        where: { assetTag: { startsWith: tagPrefix } }
      });
      const assetTag = `${tagPrefix}${String(existingCount + 1).padStart(4, '0')}`;

      // Create new asset
      asset = await prisma.asset.create({
        data: {
          assetTag,
          ...dataObj
        }
      });
      assetsCreated++;

      // Create Assignment history
      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      await prisma.assignment.create({
        data: {
          assetId: asset.id,
          userId: user.id,
          action: 'ASSIGN',
          performedById: adminUser ? adminUser.id : user.id,
          notes: 'Initial Bulk Import from Excel Data sheet'
        }
      });
    }
  }

  console.log(`Import Complete!`);
  console.log(`- New Users Added: ${usersCreated}`);
  console.log(`- New Assets Created: ${assetsCreated}`);
  console.log(`- Existing Assets Updated: ${assetsUpdated}`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
