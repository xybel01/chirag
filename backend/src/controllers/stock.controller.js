const prisma = require('../config/prisma');
const HttpError = require('../utils/httpError');
const { logAudit } = require('../services/audit');

// Asset stock summary grouped by category + status.
async function summary(_req, res) {
  const grouped = await prisma.asset.groupBy({ by: ['categoryId', 'status'], _count: { _all: true } });
  const categories = await prisma.category.findMany();
  const map = Object.fromEntries(categories.map((c) => [c.id, { category: c.name, AVAILABLE: 0, ASSIGNED: 0, REPAIR: 0, FAULTY: 0, LOST: 0, DISPOSED: 0, total: 0 }]));
  for (const g of grouped) {
    if (!map[g.categoryId]) continue;
    map[g.categoryId][g.status] = g._count._all;
    map[g.categoryId].total += g._count._all;
  }
  res.json(Object.values(map));
}

// Accessories & consumables
async function listItems(req, res) {
  const where = req.query.type ? { type: req.query.type } : {};
  const items = await prisma.stockItem.findMany({ where, include: { location: true }, orderBy: { name: 'asc' } });
  res.json(items.map((i) => ({ ...i, lowStock: i.quantity <= i.minQuantity })));
}

async function createItem(req, res) {
  const item = await prisma.stockItem.create({ data: req.body });
  await logAudit({ userId: req.user.id, action: 'CREATE', entity: 'StockItem', entityId: item.id, after: item, ip: req.ip });
  res.status(201).json(item);
}

async function updateItem(req, res) {
  const id = Number(req.params.id);
  const before = await prisma.stockItem.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, 'Stock item not found');
  const item = await prisma.stockItem.update({ where: { id }, data: req.body });
  await logAudit({ userId: req.user.id, action: 'UPDATE', entity: 'StockItem', entityId: id, before, after: item, ip: req.ip });
  res.json(item);
}

// Atomic quantity adjustment: { delta: +5 } restock, { delta: -1 } issue.
async function adjust(req, res) {
  const id = Number(req.params.id);
  const { delta, reason } = req.body;
  const before = await prisma.stockItem.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, 'Stock item not found');
  if (before.quantity + delta < 0) throw new HttpError(400, 'Not enough stock');
  const item = await prisma.stockItem.update({ where: { id }, data: { quantity: { increment: delta } } });
  await logAudit({ userId: req.user.id, action: delta > 0 ? 'RESTOCK' : 'ISSUE', entity: 'StockItem', entityId: id, before, after: { ...item, reason }, ip: req.ip });
  res.json(item);
}

module.exports = { summary, listItems, createItem, updateItem, adjust };
