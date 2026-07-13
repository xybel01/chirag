const prisma = require('../config/prisma');
const config = require('../config');
const { toExcel, toPdf } = require('../services/exporter');

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Shared: send as JSON, xlsx or pdf depending on ?format=
async function send(res, format, payload) {
  if (format === 'xlsx') return toExcel(res, payload);
  if (format === 'pdf') return toPdf(res, payload);
  return res.json(payload);
}

const ASSET_COLUMNS = [
  { header: 'Asset Tag', key: 'assetTag', width: 15 },
  { header: 'Category', key: 'category', width: 14 },
  { header: 'Manufacturer', key: 'manufacturer', width: 14 },
  { header: 'Model', key: 'model', width: 18 },
  { header: 'Serial No.', key: 'serialNumber', width: 18 },
  { header: 'Status', key: 'status', width: 10 },
  { header: 'Assigned To', key: 'assignedTo', width: 18 },
  { header: 'Department', key: 'department', width: 14 },
  { header: 'Location', key: 'location', width: 14 },
  { header: 'Purchase Date', key: 'purchaseDate', width: 12 },
  { header: 'Price', key: 'purchasePrice', width: 10 },
  { header: 'Warranty End', key: 'warrantyEnd', width: 12 },
];

const flattenAsset = (a) => ({
  assetTag: a.assetTag, category: a.category?.name, manufacturer: a.manufacturer, model: a.model,
  serialNumber: a.serialNumber, status: a.status, assignedTo: a.assignedTo?.name || '',
  department: a.department?.name || '', location: a.location?.name || '',
  purchaseDate: fmtDate(a.purchaseDate), purchasePrice: a.purchasePrice ? Number(a.purchasePrice) : '',
  warrantyEnd: fmtDate(a.warrantyEnd),
});

const assetInclude = { category: true, assignedTo: true, department: true, location: true };

async function assets(req, res) {
  const where = {
    ...(req.query.status ? { status: req.query.status } : {}),
    ...(req.query.categoryId ? { categoryId: Number(req.query.categoryId) } : {}),
    ...(req.query.departmentId ? { departmentId: Number(req.query.departmentId) } : {}),
    ...(req.query.userId ? { assignedToId: Number(req.query.userId) } : {}),
  };
  const items = await prisma.asset.findMany({ where, include: assetInclude, orderBy: { assetTag: 'asc' } });
  await send(res, req.query.format, { title: 'Asset Report', columns: ASSET_COLUMNS, rows: items.map(flattenAsset) });
}

async function warrantyExpiry(req, res) {
  const days = Number(req.query.days || config.warrantyAlertDays);
  const items = await prisma.asset.findMany({
    where: { warrantyEnd: { lte: new Date(Date.now() + days * 86400000) }, status: { notIn: ['DISPOSED', 'LOST'] } },
    include: assetInclude, orderBy: { warrantyEnd: 'asc' },
  });
  await send(res, req.query.format, { title: `Warranty Expiry Report (${days} days)`, columns: ASSET_COLUMNS, rows: items.map(flattenAsset) });
}

async function licenseExpiry(req, res) {
  const days = Number(req.query.days || config.licenseAlertDays);
  const items = await prisma.license.findMany({
    where: { expiryDate: { lte: new Date(Date.now() + days * 86400000) } },
    include: { vendor: true, assignments: { where: { revokedAt: null } } }, orderBy: { expiryDate: 'asc' },
  });
  await send(res, req.query.format, {
    title: `License Expiry Report (${days} days)`,
    columns: [
      { header: 'License', key: 'name', width: 28 }, { header: 'Type', key: 'type', width: 14 },
      { header: 'Vendor', key: 'vendor', width: 16 }, { header: 'Seats', key: 'seats', width: 10 },
      { header: 'Used', key: 'used', width: 8 }, { header: 'Expiry', key: 'expiryDate', width: 12 },
      { header: 'Total Cost', key: 'totalCost', width: 12 },
    ],
    rows: items.map((l) => ({ name: l.name, type: l.type, vendor: l.vendor?.name || '', seats: l.totalSeats, used: l.assignments.length, expiryDate: fmtDate(l.expiryDate), totalCost: l.totalCost ? Number(l.totalCost) : '' })),
  });
}

async function repairs(req, res) {
  const items = await prisma.repairTicket.findMany({
    where: req.query.status ? { status: req.query.status } : {},
    include: { asset: { include: { category: true } }, vendor: true, reportedBy: true }, orderBy: { openedAt: 'desc' },
  });
  await send(res, req.query.format, {
    title: 'Repair Report',
    columns: [
      { header: 'Ticket', key: 'ticketNo', width: 14 }, { header: 'Asset', key: 'asset', width: 16 },
      { header: 'Issue', key: 'issue', width: 30 }, { header: 'Vendor', key: 'vendor', width: 16 },
      { header: 'Warranty', key: 'warranty', width: 10 }, { header: 'Cost', key: 'cost', width: 10 },
      { header: 'Status', key: 'status', width: 14 }, { header: 'Opened', key: 'openedAt', width: 12 },
      { header: 'Closed', key: 'closedAt', width: 12 },
    ],
    rows: items.map((t) => ({ ticketNo: t.ticketNo, asset: t.asset.assetTag, issue: t.issue, vendor: t.vendor?.name || '', warranty: t.isWarrantyClaim ? 'Yes' : 'No', cost: Number(t.cost), status: t.status, openedAt: fmtDate(t.openedAt), closedAt: fmtDate(t.closedAt) })),
  });
}

async function purchases(req, res) {
  const { from, to } = req.query;
  const items = await prisma.asset.findMany({
    where: { purchaseDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } },
    include: assetInclude, orderBy: { purchaseDate: 'desc' },
  });
  await send(res, req.query.format, { title: 'Purchase Report', columns: ASSET_COLUMNS, rows: items.map(flattenAsset) });
}

module.exports = { assets, warrantyExpiry, licenseExpiry, repairs, purchases };
