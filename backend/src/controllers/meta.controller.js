const prisma = require('../config/prisma');
const { logAudit } = require('../services/audit');

// Lookup tables: categories, departments, locations, vendors.
const MODELS = { categories: 'category', departments: 'department', locations: 'location', vendors: 'vendor' };

async function list(req, res) {
  const model = MODELS[req.params.type];
  if (!model) return res.status(404).json({ error: 'Unknown lookup type' });
  res.json(await prisma[model].findMany({ orderBy: { name: 'asc' } }));
}

async function create(req, res) {
  const model = MODELS[req.params.type];
  if (!model) return res.status(404).json({ error: 'Unknown lookup type' });
  const item = await prisma[model].create({ data: req.body });
  await logAudit({ userId: req.user.id, action: 'CREATE', entity: model, entityId: item.id, after: item, ip: req.ip });
  res.status(201).json(item);
}

async function update(req, res) {
  const model = MODELS[req.params.type];
  if (!model) return res.status(404).json({ error: 'Unknown lookup type' });
  const item = await prisma[model].update({ where: { id: Number(req.params.id) }, data: req.body });
  await logAudit({ userId: req.user.id, action: 'UPDATE', entity: model, entityId: item.id, after: item, ip: req.ip });
  res.json(item);
}

async function remove(req, res) {
  const model = MODELS[req.params.type];
  if (!model) return res.status(404).json({ error: 'Unknown lookup type' });
  try {
    const item = await prisma[model].delete({ where: { id: Number(req.params.id) } });
    await logAudit({ userId: req.user.id, action: 'DELETE', entity: model, entityId: item.id, before: item, ip: req.ip });
    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { list, create, update, remove };
