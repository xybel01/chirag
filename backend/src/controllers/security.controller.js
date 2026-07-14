const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getStatus(req, res) {
  try {
    const totalDevices = await prisma.asset.count({
      where: { category: { name: { in: ['Laptop', 'Desktop'] } } }
    });

    const bitlockerCount = await prisma.asset.count({
      where: {
        category: { name: { in: ['Laptop', 'Desktop'] } },
        bitLockerStatus: 'Enabled'
      }
    });

    const secureBootCount = await prisma.asset.count({
      where: {
        category: { name: { in: ['Laptop', 'Desktop'] } },
        secureBootStatus: 'Enabled'
      }
    });

    const defenderRunning = await prisma.asset.count({
      where: {
        category: { name: { in: ['Laptop', 'Desktop'] } },
        defenderStatus: { contains: 'Running', mode: 'insensitive' }
      }
    });

    const vulnerabilities = [
      { id: 'vuln-01', cve: 'CVE-2026-0001', severity: 'HIGH', package: 'OpenSSL 3.0.x', status: 'PATCH_PENDING', affectedCount: 4 },
      { id: 'vuln-02', cve: 'CVE-2026-1024', severity: 'MEDIUM', package: 'Google Chrome', status: 'RESOLVED', affectedCount: 15 }
    ];

    const complianceScore = totalDevices > 0 ? Math.round(((bitlockerCount + secureBootCount + defenderRunning) / (totalDevices * 3)) * 100) : 100;

    res.json({
      totalDevices,
      metrics: {
        bitlockerPercentage: totalDevices > 0 ? Math.round((bitlockerCount / totalDevices) * 100) : 100,
        secureBootPercentage: totalDevices > 0 ? Math.round((secureBootCount / totalDevices) * 100) : 100,
        defenderPercentage: totalDevices > 0 ? Math.round((defenderRunning / totalDevices) * 100) : 100,
        complianceScore
      },
      vulnerabilities,
      standards: [
        { name: 'ISO 27001 Annex A.12', status: 'COMPLIANT', score: '95%' },
        { name: 'Cyber Essentials Scheme V3.0', status: 'COMPLIANT', score: '92%' },
        { name: 'GDPR Article 32 Encryption', status: 'WARNING', score: '88%' }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getStatus };
