const prisma = require('../config/prisma');
const HttpError = require('../utils/httpError');
const paginate = require('../utils/pagination');
const { logAudit } = require('../services/audit');
const { sendMail, layout } = require('../services/email');
const { notifyTeams } = require('../services/teams');
const config = require('../config');

const include = { asset: { include: { category: true, assignedTo: { select: { id: true, name: true, email: true } } } }, reportedBy: { select: { id: true, name: true } }, vendor: true };

async function list(req, res) {
  const { skip, take, page, pageSize } = paginate(req.query);
  const where = {
    ...(req.query.status ? { status: req.query.status } : {}),
    ...(req.query.assetId ? { assetId: Number(req.query.assetId) } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.repairTicket.findMany({ where, include, skip, take, orderBy: { openedAt: 'desc' } }),
    prisma.repairTicket.count({ where }),
  ]);
  res.json({ items, total, page, pageSize });
}

async function get(req, res) {
  const ticket = await prisma.repairTicket.findUnique({ where: { id: Number(req.params.id) }, include });
  if (!ticket) throw new HttpError(404, 'Repair ticket not found');
  res.json(ticket);
}

async function create(req, res) {
  const count = await prisma.repairTicket.count();
  const ticketNo = `RT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  const [ticket] = await prisma.$transaction([
    prisma.repairTicket.create({ data: { ...req.body, ticketNo, reportedById: req.user.id }, include }),
    prisma.asset.update({ where: { id: req.body.assetId }, data: { status: 'REPAIR' } }),
  ]);
  await logAudit({ userId: req.user.id, action: 'CREATE', entity: 'RepairTicket', entityId: ticket.id, after: ticket, ip: req.ip });
  notifyTeams('Repair ticket opened', `${ticket.ticketNo} for asset ${ticket.asset.assetTag}: ${ticket.issue}`);
  res.status(201).json(ticket);
}

async function update(req, res) {
  const id = Number(req.params.id);
  const before = await prisma.repairTicket.findUnique({ where: { id }, include });
  if (!before) throw new HttpError(404, 'Repair ticket not found');
  const closing = req.body.status && ['COMPLETED', 'CANCELLED'].includes(req.body.status) && before.status !== req.body.status;

  const ticket = await prisma.repairTicket.update({
    where: { id },
    data: { ...req.body, ...(closing ? { closedAt: new Date() } : {}) },
    include,
  });

  if (closing && req.body.status === 'COMPLETED') {
    // Asset returns to service: assigned if it still has a holder, else available.
    await prisma.asset.update({
      where: { id: ticket.assetId },
      data: { status: ticket.asset.assignedTo ? 'ASSIGNED' : 'AVAILABLE' },
    });
    const holder = ticket.asset.assignedTo;
    if (holder) {
      sendMail({
        to: holder.email, cc: config.itManagerEmail || undefined,
        subject: `[IT Inventory] Repair completed — ${ticket.asset.assetTag}`,
        html: layout('Repair Completed', `<p>Repair of <b>${ticket.asset.assetTag}</b> (${ticket.issue}) is complete.</p><p>Cost: ${ticket.cost} | Warranty claim: ${ticket.isWarrantyClaim ? 'Yes' : 'No'}</p>`),
      });
    }
    notifyTeams('Repair completed', `${ticket.ticketNo} for ${ticket.asset.assetTag} closed. Cost: ${ticket.cost}`);
  }

  await logAudit({ userId: req.user.id, action: 'UPDATE', entity: 'RepairTicket', entityId: id, before, after: ticket, ip: req.ip });
  res.json(ticket);
}

module.exports = { list, get, create, update };
