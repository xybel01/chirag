const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list(req, res) {
  const { assetId } = req.query;
  try {
    const items = await prisma.maintenance.findMany({
      where: assetId ? { assetId: Number(assetId) } : {},
      include: { asset: { select: { assetTag: true, model: true } } },
      orderBy: { maintenanceDate: 'desc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function create(req, res) {
  const { assetId, maintenanceDate, notes, performedBy, cost, nextDueDate, status } = req.body;
  try {
    const log = await prisma.maintenance.create({
      data: {
        assetId: Number(assetId),
        maintenanceDate: new Date(maintenanceDate),
        notes,
        performedBy,
        cost: cost ? Number(cost) : 0,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        status: status || 'COMPLETED'
      }
    });

    // Update Asset fields
    await prisma.asset.update({
      where: { id: Number(assetId) },
      data: {
        lastMaintenance: new Date(maintenanceDate),
        nextMaintenance: nextDueDate ? new Date(nextDueDate) : null
      }
    });

    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    await prisma.maintenance.delete({ where: { id: Number(id) } });
    res.json({ success: true, message: 'Maintenance record deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { list, create, remove };
