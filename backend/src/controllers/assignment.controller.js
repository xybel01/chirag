const prisma = require('../config/prisma');
const HttpError = require('../utils/httpError');
const paginate = require('../utils/pagination');
const { logAudit } = require('../services/audit');
const { generateAckPdf } = require('../services/ackForm');
const { sendMail, layout } = require('../services/email');
const { notifyTeams } = require('../services/teams');
const config = require('../config');
const firebaseService = require('../services/firebase.service');
const path = require('path');
const { UPLOAD_DIR } = require('../middleware/upload');

const include = {
  asset: { include: { category: true } },
  user: { select: { id: true, name: true, email: true, department: true } },
  performedBy: { select: { id: true, name: true } },
};

async function list(req, res) {
  const { skip, take, page, pageSize } = paginate(req.query);
  const where = {
    ...(req.query.assetId ? { assetId: Number(req.query.assetId) } : {}),
    ...(req.query.userId ? { userId: Number(req.query.userId) } : {}),
    ...(req.query.action ? { action: req.query.action } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.assignment.findMany({ where, include, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.assignment.count({ where }),
  ]);
  res.json({ items, total, page, pageSize });
}

// Maps assignment actions to the asset status they leave behind.
const STATUS_AFTER = {
  ASSIGN: 'ASSIGNED', RETURN: 'AVAILABLE', TRANSFER: 'ASSIGNED',
  REPLACE: 'ASSIGNED', REPAIR: 'REPAIR', DISPOSE: 'DISPOSED',
};

async function act(req, res) {
  const { assetId, userId, action, notes, signature } = req.body;
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, include: { category: true, assignedTo: true } });
  if (!asset) throw new HttpError(404, 'Asset not found');

  if (action === 'ASSIGN' && asset.status !== 'AVAILABLE') throw new HttpError(400, `Asset is ${asset.status}, not available`);
  if (['RETURN', 'TRANSFER'].includes(action) && asset.status !== 'ASSIGNED') throw new HttpError(400, 'Asset is not currently assigned');

  const targetUserId = action === 'RETURN' ? asset.assignedToId : userId;
  if (!targetUserId) throw new HttpError(400, 'userId is required for this action');
  const employee = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!employee) throw new HttpError(404, 'Employee not found');

  const [assignment] = await prisma.$transaction([
    prisma.assignment.create({
      data: { assetId, userId: targetUserId, action, notes, signature, performedById: req.user.id, ...(action === 'RETURN' ? { returnedAt: new Date() } : {}) },
      include,
    }),
    prisma.asset.update({
      where: { id: assetId },
      data: { status: STATUS_AFTER[action], assignedToId: ['ASSIGN', 'TRANSFER', 'REPLACE'].includes(action) ? targetUserId : null },
    }),
  ]);

  // Acknowledgement PDF with digital signature
  let ackFile = null;
  try {
    ackFile = await generateAckPdf({ assignment, asset, employee, actor: req.user });
    await prisma.assignment.update({ where: { id: assignment.id }, data: { ackFile } });
    
    const localFilePath = path.join(UPLOAD_DIR, ackFile);
    await firebaseService.uploadToFirebaseStorage(localFilePath, ackFile, 'application/pdf');
  } catch (err) { console.error('Ack PDF generation failed:', err.message); }

  // Email employee + IT manager, notify Teams
  const verb = { ASSIGN: 'assigned to', RETURN: 'returned by', TRANSFER: 'transferred to', REPLACE: 'replaced for', REPAIR: 'sent to repair for', DISPOSE: 'disposed (last held by)' }[action];
  const subject = `[IT Inventory] Asset ${asset.assetTag} ${action.toLowerCase()}`;
  const html = layout(`Asset ${action}`, `
    <p>Asset <b>${asset.assetTag}</b> (${asset.manufacturer} ${asset.model}, SN ${asset.serialNumber}) has been ${verb} <b>${employee.name}</b>.</p>
    ${notes ? `<p>Notes: ${notes}</p>` : ''}
    <p>The acknowledgement form is attached for your records.</p>`);
  const attachments = ackFile ? [{ filename: 'acknowledgement.pdf', path: `${__dirname}/../../uploads/${ackFile}` }] : [];
  sendMail({ to: employee.email, cc: config.itManagerEmail || undefined, subject, html, attachments });
  notifyTeams(`Asset ${action}`, `${asset.assetTag} ${verb} ${employee.name} by ${req.user.name}.`, [['Asset', `${asset.manufacturer} ${asset.model}`], ['Serial', asset.serialNumber]]);

  await logAudit({ userId: req.user.id, action, entity: 'Asset', entityId: assetId, after: { action, employee: employee.email }, ip: req.ip });
  res.status(201).json({ ...assignment, ackFile });
}

async function myAssets(req, res) {
  const assets = await prisma.asset.findMany({ where: { assignedToId: req.user.id }, include: { category: true, location: true } });
  res.json(assets);
}

module.exports = { list, act, myAssets };
