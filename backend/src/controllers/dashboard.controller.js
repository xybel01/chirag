const prisma = require('../config/prisma');
const config = require('../config');

async function stats(_req, res) {
  const now = new Date();
  const soon = (d) => new Date(now.getTime() + d * 86400000);

  const [byStatus, byCategory, byDepartment, byLocation, warrantyExpiring, licenseExpiring, openRepairs, stockItems, totalUsers] = await Promise.all([
    prisma.asset.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.asset.groupBy({ by: ['categoryId'], _count: { _all: true } }),
    prisma.asset.groupBy({ by: ['departmentId'], _count: { _all: true } }),
    prisma.asset.groupBy({ by: ['locationId'], _count: { _all: true } }),
    prisma.asset.count({ where: { warrantyEnd: { gte: now, lte: soon(config.warrantyAlertDays) }, status: { notIn: ['DISPOSED', 'LOST'] } } }),
    prisma.license.count({ where: { expiryDate: { gte: now, lte: soon(config.licenseAlertDays) } } }),
    prisma.repairTicket.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.stockItem.findMany(),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  const [categories, departments, locations] = await Promise.all([
    prisma.category.findMany(), prisma.department.findMany(), prisma.location.findMany(),
  ]);
  const nameOf = (list, id, fallback = 'Unassigned') => list.find((x) => x.id === id)?.name || fallback;

  const statusCount = (s) => byStatus.find((g) => g.status === s)?._count._all || 0;
  res.json({
    totals: {
      total: byStatus.reduce((a, g) => a + g._count._all, 0),
      available: statusCount('AVAILABLE'),
      assigned: statusCount('ASSIGNED'),
      faulty: statusCount('FAULTY'),
      repair: statusCount('REPAIR'),
      lost: statusCount('LOST'),
      disposed: statusCount('DISPOSED'),
      warrantyExpiring, licenseExpiring, openRepairs,
      lowStock: stockItems.filter((s) => s.quantity <= s.minQuantity).length,
      users: totalUsers,
    },
    byCategory: byCategory.map((g) => ({ name: nameOf(categories, g.categoryId), count: g._count._all })),
    byDepartment: byDepartment.map((g) => ({ name: nameOf(departments, g.departmentId), count: g._count._all })),
    byLocation: byLocation.map((g) => ({ name: nameOf(locations, g.locationId), count: g._count._all })),
  });
}

module.exports = { stats };
