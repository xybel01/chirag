const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const HttpError = require('../utils/httpError');
const paginate = require('../utils/pagination');
const { logAudit } = require('../services/audit');

const select = { id: true, email: true, name: true, role: true, phone: true, jobTitle: true, isActive: true, departmentId: true, department: true, createdAt: true };

async function list(req, res) {
  const { skip, take, page, pageSize } = paginate(req.query);
  const where = {
    ...(req.query.search ? { OR: [{ name: { contains: req.query.search, mode: 'insensitive' } }, { email: { contains: req.query.search, mode: 'insensitive' } }] } : {}),
    ...(req.query.role ? { role: req.query.role } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select, skip, take, orderBy: { name: 'asc' } }),
    prisma.user.count({ where }),
  ]);
  res.json({ items, total, page, pageSize });
}

async function get(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
    select: { ...select, assets: { include: { category: true } }, licenseAssignments: { where: { revokedAt: null }, include: { license: true } } },
  });
  if (!user) throw new HttpError(404, 'User not found');
  res.json(user);
}

async function create(req, res) {
  const { password, ...data } = req.body;
  const user = await prisma.user.create({
    data: { ...data, email: data.email.toLowerCase(), passwordHash: password ? await bcrypt.hash(password, 12) : null },
    select,
  });
  await logAudit({ userId: req.user.id, action: 'CREATE', entity: 'User', entityId: user.id, after: user, ip: req.ip });
  res.status(201).json(user);
}

async function update(req, res) {
  const id = Number(req.params.id);
  const before = await prisma.user.findUnique({ where: { id }, select });
  if (!before) throw new HttpError(404, 'User not found');
  const { password, ...data } = req.body;
  const user = await prisma.user.update({
    where: { id },
    data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    select,
  });
  await logAudit({ userId: req.user.id, action: 'UPDATE', entity: 'User', entityId: id, before, after: user, ip: req.ip });
  res.json(user);
}

async function deactivate(req, res) {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'You cannot deactivate your own account');
  const user = await prisma.user.update({ where: { id }, data: { isActive: false }, select });
  await logAudit({ userId: req.user.id, action: 'DEACTIVATE', entity: 'User', entityId: id, ip: req.ip });
  res.json(user);
}

module.exports = { list, get, create, update, deactivate };
