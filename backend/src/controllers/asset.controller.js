const prisma = require('../config/prisma');
const HttpError = require('../utils/httpError');
const paginate = require('../utils/pagination');
const { logAudit } = require('../services/audit');
const { assetQrPng, assetBarcodePng } = require('../services/codes');

const include = { category: true, vendor: true, location: true, department: true, assignedTo: { select: { id: true, name: true, email: true } } };

// Asset tag format: NP-<CATEGORY CODE>-<zero padded sequence>, e.g. NP-LAP-0007
async function nextAssetTag(categoryId) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new HttpError(400, 'Invalid category');
  const count = await prisma.asset.count({ where: { categoryId } });
  return `NP-${category.code}-${String(count + 1).padStart(4, '0')}`;
}

async function list(req, res) {
  const { skip, take, page, pageSize } = paginate(req.query);
  const q = req.query;
  const where = {
    ...(q.search ? { OR: [
      { assetTag: { contains: q.search, mode: 'insensitive' } },
      { serialNumber: { contains: q.search, mode: 'insensitive' } },
      { model: { contains: q.search, mode: 'insensitive' } },
      { manufacturer: { contains: q.search, mode: 'insensitive' } },
    ] } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.categoryId ? { categoryId: Number(q.categoryId) } : {}),
    ...(q.departmentId ? { departmentId: Number(q.departmentId) } : {}),
    ...(q.locationId ? { locationId: Number(q.locationId) } : {}),
    ...(q.assignedToId ? { assignedToId: Number(q.assignedToId) } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.asset.findMany({ where, include, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.asset.count({ where }),
  ]);
  res.json({ items, total, page, pageSize });
}

async function get(req, res) {
  const asset = await prisma.asset.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      ...include,
      assignments: { include: { user: { select: { id: true, name: true } }, performedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      repairTickets: { include: { vendor: true }, orderBy: { openedAt: 'desc' } },
    },
  });
  if (!asset) throw new HttpError(404, 'Asset not found');
  res.json(asset);
}

function parseBody(body, files) {
  const dateOrNull = (v) => (v ? new Date(v) : null);
  return {
    serialNumber: body.serialNumber,
    model: body.model,
    manufacturer: body.manufacturer,
    categoryId: Number(body.categoryId),
    vendorId: body.vendorId ? Number(body.vendorId) : null,
    purchaseDate: dateOrNull(body.purchaseDate),
    purchasePrice: body.purchasePrice ? body.purchasePrice : null,
    warrantyStart: dateOrNull(body.warrantyStart),
    warrantyEnd: dateOrNull(body.warrantyEnd),
    locationId: body.locationId ? Number(body.locationId) : null,
    departmentId: body.departmentId ? Number(body.departmentId) : null,
    status: body.status || undefined,
    notes: body.notes || null,
    ...(files?.invoice?.[0] ? { invoiceFile: files.invoice[0].filename } : {}),
    ...(files?.warrantyDoc?.[0] ? { warrantyFile: files.warrantyDoc[0].filename } : {}),
  };
}

async function create(req, res) {
  const data = parseBody(req.body, req.files);
  data.assetTag = await nextAssetTag(data.categoryId);
  const asset = await prisma.asset.create({ data, include });
  await logAudit({ userId: req.user.id, action: 'CREATE', entity: 'Asset', entityId: asset.id, after: asset, ip: req.ip });
  res.status(201).json(asset);
}

async function update(req, res) {
  const id = Number(req.params.id);
  const before = await prisma.asset.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, 'Asset not found');
  const data = parseBody(req.body, req.files);
  delete data.categoryId; // category (and therefore tag) is immutable after creation
  const asset = await prisma.asset.update({ where: { id }, data, include });
  await logAudit({ userId: req.user.id, action: 'UPDATE', entity: 'Asset', entityId: id, before, after: asset, ip: req.ip });
  res.json(asset);
}

async function remove(req, res) {
  const id = Number(req.params.id);
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw new HttpError(404, 'Asset not found');
  if (asset.status === 'ASSIGNED') throw new HttpError(400, 'Return the asset before deleting it');
  // Soft delete: mark disposed rather than removing history.
  const updated = await prisma.asset.update({ where: { id }, data: { status: 'DISPOSED' } });
  await logAudit({ userId: req.user.id, action: 'DISPOSE', entity: 'Asset', entityId: id, before: asset, after: updated, ip: req.ip });
  res.json(updated);
}

async function qrcode(req, res) {
  const asset = await prisma.asset.findUnique({ where: { id: Number(req.params.id) } });
  if (!asset) throw new HttpError(404, 'Asset not found');
  res.type('png').send(await assetQrPng(asset));
}

async function barcode(req, res) {
  const asset = await prisma.asset.findUnique({ where: { id: Number(req.params.id) } });
  if (!asset) throw new HttpError(404, 'Asset not found');
  res.type('png').send(await assetBarcodePng(asset));
}

module.exports = { list, get, create, update, remove, qrcode, barcode };
