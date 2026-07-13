const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Secret validation token
const REGISTRATION_TOKEN = 'ITAM-AGENT-SECURE-TOKEN-2026';

async function submit(req, res) {
  const token = req.headers['x-registration-token'] || req.body.registrationToken;
  if (token !== REGISTRATION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid registration token.' });
  }

  const {
    hostName,
    manufacturer,
    model,
    serialNumber,
    cpu,
    ram,
    storage,
    operatingSystem,
    macAddress,
    ipAddress,
    installedSoftware
  } = req.body;

  if (!serialNumber) {
    return res.status(400).json({ error: 'Bad Request: serialNumber is required.' });
  }

  try {
    // 1. Get Category ID (Laptop / Desktop / Computer)
    const lowerModel = String(model || '').toLowerCase();
    const catCode = lowerModel.includes('laptop') || lowerModel.includes('notebook') ? 'LAP' : 'DSK';
    const catName = catCode === 'LAP' ? 'Laptop' : 'Desktop';
    
    let category = await prisma.category.findUnique({ where: { code: catCode } });
    if (!category) {
      category = await prisma.category.create({ data: { name: catName, code: catCode } });
    }

    // 2. Format notes with custom fields & software list
    const softwareStr = (installedSoftware || [])
      .map(s => `- ${s.name} (${s.version || 'unknown'})`)
      .join('\n');
    
    const formattedNotes = `Host Name: ${hostName || 'unknown'}\n` +
      `MAC Address: ${macAddress || 'unknown'}\n` +
      `IP Address: ${ipAddress || 'unknown'}\n` +
      `Remark: Auto-Synced by Windows Agent\n` +
      `Installed Software:\n${softwareStr}`;

    // 3. Find if Asset exists by serialNumber
    let asset = await prisma.asset.findUnique({ where: { serialNumber } });

    const dataObj = {
      model: model || 'System Model',
      manufacturer: manufacturer || 'Generic',
      categoryId: category.id,
      cpu: cpu || null,
      ram: ram || null,
      storage: storage || null,
      notes: formattedNotes,
      updatedAt: new Date(),
    };

    if (asset) {
      // Check if hardware details changed to log in audit
      const before = { ram: asset.ram, cpu: asset.cpu, storage: asset.storage };
      const after = { ram: dataObj.ram, cpu: dataObj.cpu, storage: dataObj.storage };

      asset = await prisma.asset.update({
        where: { id: asset.id },
        data: dataObj,
      });

      // Audit hardware specs change if modified
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        await prisma.auditLog.create({
          data: {
            action: 'UPDATE',
            entity: 'Asset',
            entityId: String(asset.id),
            before: before,
            after: after,
            ip: req.ip || '127.0.0.1',
          }
        });
      }
    } else {
      // Generate new custom tag (detect company from hostname or default)
      const isNpl = String(hostName).toUpperCase().includes('NPL') || String(hostName).toUpperCase().includes('NATIONWIDE');
      const companyPrefix = isNpl ? 'NPL' : 'VSDENT';
      const typeSuffix = catCode === 'LAP' ? 'LT' : 'DT';
      const tagPrefix = `${companyPrefix}-${typeSuffix}-`;

      const count = await prisma.asset.count({
        where: { assetTag: { startsWith: tagPrefix } }
      });
      const assetTag = `${tagPrefix}${String(count + 1).padStart(4, '0')}`;

      // Create new asset
      asset = await prisma.asset.create({
        data: {
          assetTag,
          serialNumber,
          status: 'AVAILABLE',
          ...dataObj,
        }
      });

      // Log creation in audit
      await prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'Asset',
          entityId: String(asset.id),
          after: { assetTag, serialNumber },
          ip: req.ip || '127.0.0.1',
        }
      });
    }

    return res.json({
      success: true,
      message: 'Agent inventory sync successful.',
      assetId: asset.assetTag
    });

  } catch (error) {
    console.error('Agent submit endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
  }
}

module.exports = { submit };
