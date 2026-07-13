const prisma = require('../config/prisma');
const paginate = require('../utils/pagination');

async function list(req, res) {
  const { skip, take, page, pageSize } = paginate(req.query);
  const where = {
    ...(req.query.entity ? { entity: req.query.entity } : {}),
    ...(req.query.entityId ? { entityId: String(req.query.entityId) } : {}),
    ...(req.query.userId ? { userId: Number(req.query.userId) } : {}),
    ...(req.query.action ? { action: req.query.action } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { select: { id: true, name: true, email: true } } }, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ items, total, page, pageSize });
}

module.exports = { list };
