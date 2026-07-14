const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==========================================
// PURCHASE REQUESTS
// ==========================================
async function listRequests(req, res) {
  try {
    const items = await prisma.purchaseRequest.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createRequest(req, res) {
  const { title, costCenter, estimatedCost } = req.body;
  try {
    const item = await prisma.purchaseRequest.create({
      data: {
        title,
        costCenter,
        estimatedCost: Number(estimatedCost),
        requestedBy: req.user.name
      }
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function approveRequest(req, res) {
  const { id } = req.params;
  try {
    const request = await prisma.purchaseRequest.update({
      where: { id: Number(id) },
      data: { status: 'APPROVED' }
    });

    // Create related Purchase Order draft automatically
    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO-2026-${String(count + 1).padStart(4, '0')}`;
    
    await prisma.purchaseOrder.create({
      data: {
        poNumber,
        vendorName: 'Default IT Supplier Ltd',
        totalAmount: request.estimatedCost,
        costCenter: request.costCenter,
        status: 'DRAFT'
      }
    });

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// PURCHASE ORDERS
// ==========================================
async function listOrders(req, res) {
  try {
    const items = await prisma.purchaseOrder.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function receiveOrder(req, res) {
  const { id } = req.params;
  try {
    const order = await prisma.purchaseOrder.update({
      where: { id: Number(id) },
      data: { status: 'RECEIVED' }
    });

    // Convert PO receipt into real physical assets in database
    const categoryLap = await prisma.category.findFirst({ where: { code: 'LAP' } });
    const defaultCategory = categoryLap ? categoryLap.id : 1;

    // Create 3 laptops automatically as assets
    const assetPromises = Array.from({ length: 3 }).map(async (_, idx) => {
      const tagCount = await prisma.asset.count();
      const tag = `NP-LAP-${String(tagCount + 1).padStart(4, '0')}`;
      const serial = `SN-PO-${order.poNumber}-${idx + 1}`;
      
      return prisma.asset.create({
        data: {
          assetTag: tag,
          serialNumber: serial,
          model: 'Lenovo ThinkPad PO Bundle',
          manufacturer: 'Lenovo',
          categoryId: defaultCategory,
          status: 'AVAILABLE',
          costCentre: order.costCenter,
          purchasePrice: order.totalAmount / 3,
          notes: `Auto-instantiated from PO Number ${order.poNumber}.`
        }
      });
    });
    await Promise.all(assetPromises);

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { listRequests, createRequest, approveRequest, listOrders, receiveOrder };
