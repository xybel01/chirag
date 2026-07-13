const prisma = require('../config/prisma');
const HttpError = require('../utils/httpError');
const paginate = require('../utils/pagination');
const { logAudit } = require('../services/audit');

const include = { vendor: true, assignments: { where: { revokedAt: null }, include: { user: { select: { id: true, name: true, email: true } } } } };

async function list(req, res) {
  const { skip, take, page, pageSize } = paginate(req.query);
  const where = {
    ...(req.query.type ? { type: req.query.type } : {}),
    ...(req.query.search ? { name: { contains: req.query.search, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.license.findMany({ where, include, skip, take, orderBy: { expiryDate: 'asc' } }),
    prisma.license.count({ where }),
  ]);
  res.json({
    items: items.map((l) => ({ ...l, seatsUsed: l.assignments.length, seatsFree: l.totalSeats - l.assignments.length })),
    total, page, pageSize,
  });
}

async function get(req, res) {
  const license = await prisma.license.findUnique({
    where: { id: Number(req.params.id) },
    include: { vendor: true, assignments: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { assignedAt: 'desc' } } },
  });
  if (!license) throw new HttpError(404, 'License not found');
  res.json(license);
}

function parse(body) {
  return {
    ...body,
    purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
    expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
  };
}

async function create(req, res) {
  const license = await prisma.license.create({ data: parse(req.body), include });
  await logAudit({ userId: req.user.id, action: 'CREATE', entity: 'License', entityId: license.id, after: license, ip: req.ip });
  res.status(201).json(license);
}

async function update(req, res) {
  const id = Number(req.params.id);
  const before = await prisma.license.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, 'License not found');
  const license = await prisma.license.update({ where: { id }, data: parse(req.body), include });
  await logAudit({ userId: req.user.id, action: 'UPDATE', entity: 'License', entityId: id, before, after: license, ip: req.ip });
  res.json(license);
}

async function assignSeat(req, res) {
  const licenseId = Number(req.params.id);
  const { userId } = req.body;
  const license = await prisma.license.findUnique({ where: { id: licenseId }, include: { assignments: { where: { revokedAt: null } } } });
  if (!license) throw new HttpError(404, 'License not found');
  if (license.assignments.length >= license.totalSeats) throw new HttpError(400, 'No free seats on this license');
  if (license.assignments.some((a) => a.userId === userId)) throw new HttpError(400, 'User already has this license');
  const assignment = await prisma.licenseAssignment.create({ data: { licenseId, userId }, include: { user: { select: { id: true, name: true } } } });
  await logAudit({ userId: req.user.id, action: 'ASSIGN', entity: 'License', entityId: licenseId, after: { userId }, ip: req.ip });
  res.status(201).json(assignment);
}

async function revokeSeat(req, res) {
  const id = Number(req.params.assignmentId);
  const assignment = await prisma.licenseAssignment.update({ where: { id }, data: { revokedAt: new Date() } });
  await logAudit({ userId: req.user.id, action: 'REVOKE', entity: 'License', entityId: assignment.licenseId, after: { assignmentId: id }, ip: req.ip });
  res.json(assignment);
}

module.exports = { list, get, create, update, assignSeat, revokeSeat };
