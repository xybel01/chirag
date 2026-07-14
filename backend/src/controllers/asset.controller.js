const prisma = require('../config/prisma');
const HttpError = require('../utils/httpError');
const paginate = require('../utils/pagination');
const { logAudit } = require('../services/audit');
const { assetQrPng, assetBarcodePng } = require('../services/codes');

const include = {
  category: true,
  vendor: true,
  location: true,
  department: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  maintenances: { orderBy: { maintenanceDate: 'desc' } }
};

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

async function findAssetByIdOrTag(idOrTag) {
  const isNum = /^\d+$/.test(idOrTag);
  if (isNum) {
    const asset = await prisma.asset.findUnique({ where: { id: Number(idOrTag) } });
    if (asset) return asset;
  }
  return await prisma.asset.findFirst({
    where: { OR: [{ assetTag: idOrTag }, { serialNumber: idOrTag }] }
  });
}

async function get(req, res) {
  const idOrTag = req.params.id;
  const isNum = /^\d+$/.test(idOrTag);
  const asset = await prisma.asset.findFirst({
    where: isNum ? { id: Number(idOrTag) } : { OR: [{ assetTag: idOrTag }, { serialNumber: idOrTag }] },
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
    purchasePrice: body.purchasePrice ? Number(body.purchasePrice) : null,
    warrantyStart: dateOrNull(body.warrantyStart),
    warrantyEnd: dateOrNull(body.warrantyEnd),
    locationId: body.locationId ? Number(body.locationId) : null,
    departmentId: body.departmentId ? Number(body.departmentId) : null,
    status: body.status || undefined,
    notes: body.notes || null,
    ram: body.ram || null,
    storage: body.storage || null,
    cpu: body.cpu || null,
    
    // Expanded CMDB fields
    gst: body.gst ? Number(body.gst) : null,
    insuranceDetails: body.insuranceDetails || null,
    insuranceExpiry: dateOrNull(body.insuranceExpiry),
    floor: body.floor || null,
    cabin: body.cabin || null,
    rackNumber: body.rackNumber || null,
    costCentre: body.costCentre || null,
    ownerDepartment: body.ownerDepartment || null,
    nextMaintenance: dateOrNull(body.nextMaintenance),
    lastMaintenance: dateOrNull(body.lastMaintenance),
    scrapDate: dateOrNull(body.scrapDate),
    disposalMethod: body.disposalMethod || null,

    // Laptops/Desktops specific configurations
    gpu: body.gpu || null,
    gpuMemory: body.gpuMemory || null,
    windowsEdition: body.windowsEdition || null,
    windowsVersion: body.windowsVersion || null,
    buildNumber: body.buildNumber || null,
    activationStatus: body.activationStatus || null,
    computerName: body.computerName || null,
    domainName: body.domainName || null,
    wifiMac: body.wifiMac || null,
    bluetoothMac: body.bluetoothMac || null,
    bitLockerStatus: body.bitLockerStatus || null,
    tpmVersion: body.tpmVersion || null,
    secureBootStatus: body.secureBootStatus || null,
    defenderStatus: body.defenderStatus || null,
    esetStatus: body.esetStatus || null,
    firewallStatus: body.firewallStatus || null,
    recoveryKey: body.recoveryKey || null,

    // Printer specific
    drumModel: body.drumModel || null,
    currentPageCount: body.currentPageCount ? Number(body.currentPageCount) : 0,

    // Mobile specific
    imeiNumber2: body.imeiNumber2 || null,
    carrier: body.carrier || null,
    mdmStatus: body.mdmStatus || null,

    // Network specific
    wanIp: body.wanIp || null,
    portsCount: body.portsCount ? Number(body.portsCount) : null,
    ispName: body.ispName || null,
    firmwareVersion: body.firmwareVersion || null,

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
  const asset = await findAssetByIdOrTag(req.params.id);
  if (!asset) throw new HttpError(404, 'Asset not found');
  const data = parseBody(req.body, req.files);
  delete data.categoryId; // category (and therefore tag) is immutable after creation
  const updated = await prisma.asset.update({ where: { id: asset.id }, data, include });
  await logAudit({ userId: req.user.id, action: 'UPDATE', entity: 'Asset', entityId: asset.id, before: asset, after: updated, ip: req.ip });
  res.json(updated);
}

async function remove(req, res) {
  const asset = await findAssetByIdOrTag(req.params.id);
  if (!asset) throw new HttpError(404, 'Asset not found');
  if (asset.status === 'ASSIGNED') throw new HttpError(400, 'Return the asset before deleting it');
  // Soft delete: mark disposed rather than removing history.
  const updated = await prisma.asset.update({ where: { id: asset.id }, data: { status: 'DISPOSED' } });
  await logAudit({ userId: req.user.id, action: 'DISPOSE', entity: 'Asset', entityId: asset.id, before: asset, after: updated, ip: req.ip });
  res.json(updated);
}

async function qrcode(req, res) {
  const asset = await findAssetByIdOrTag(req.params.id);
  if (!asset) throw new HttpError(404, 'Asset not found');
  res.type('png').send(await assetQrPng(asset));
}

async function barcode(req, res) {
  const asset = await findAssetByIdOrTag(req.params.id);
  if (!asset) throw new HttpError(404, 'Asset not found');
  res.type('png').send(await assetBarcodePng(asset));
}

module.exports = { list, get, create, update, remove, qrcode, barcode };
