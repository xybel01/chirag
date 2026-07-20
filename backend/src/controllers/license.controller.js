const prisma = require('../config/prisma');

async function list(req, res) {
  const { search } = req.query;
  const where = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { type: { contains: search, mode: 'insensitive' } },
      { licenseKey: { contains: search, mode: 'insensitive' } }
    ]
  } : {};

  try {
    const items = await prisma.license.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        assignments: {
          where: { revokedAt: null },
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Map items to return active allocation count
    const mapped = items.map(item => ({
      ...item,
      activeSeatsUsed: item.assignments.length
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch software subscriptions: ' + error.message });
  }
}

async function get(req, res) {
  const { id } = req.params;
  try {
    const item = await prisma.license.findUnique({
      where: { id: Number(id) },
      include: {
        vendor: true,
        assignments: {
          where: { revokedAt: null },
          include: {
            user: { select: { id: true, name: true, email: true, jobTitle: true } }
          }
        }
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'License subscription not found.' });
    }

    res.json({
      ...item,
      activeSeatsUsed: item.assignments.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve subscription details: ' + error.message });
  }
}

async function create(req, res) {
  const { name, type, vendorId, licenseKey, totalSeats, purchaseDate, expiryDate, costPerSeat, notes, currency, taxRate } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and Type are required fields.' });
  }

  try {
    const seats = totalSeats ? Number(totalSeats) : 1;
    const perSeatCost = costPerSeat ? Number(costPerSeat) : 0;
    const tax = taxRate ? Number(taxRate) : 0;
    const totalCost = seats * perSeatCost * (1 + tax / 100);

    const newLicense = await prisma.license.create({
      data: {
        name,
        type,
        vendorId: vendorId ? Number(vendorId) : null,
        licenseKey: licenseKey || null,
        totalSeats: seats,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        costPerSeat: perSeatCost,
        totalCost,
        notes: notes || null,
        currency: currency || 'GBP',
        taxRate: tax
      }
    });

    res.status(201).json(newLicense);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subscription registry: ' + error.message });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, type, vendorId, licenseKey, totalSeats, purchaseDate, expiryDate, costPerSeat, notes, currency, taxRate } = req.body;

  try {
    const seats = totalSeats ? Number(totalSeats) : 1;
    const perSeatCost = costPerSeat ? Number(costPerSeat) : 0;
    const tax = taxRate ? Number(taxRate) : 0;
    const totalCost = seats * perSeatCost * (1 + tax / 100);

    const updated = await prisma.license.update({
      where: { id: Number(id) },
      data: {
        name,
        type,
        vendorId: vendorId ? Number(vendorId) : null,
        licenseKey: licenseKey || null,
        totalSeats: seats,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        costPerSeat: perSeatCost,
        totalCost,
        notes: notes || null,
        currency: currency || 'GBP',
        taxRate: tax
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subscription profile: ' + error.message });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    // Delete allocations first
    await prisma.licenseAssignment.deleteMany({
      where: { licenseId: Number(id) }
    });

    await prisma.license.delete({
      where: { id: Number(id) }
    });

    res.json({ success: true, message: 'License subscription removed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete license: ' + error.message });
  }
}

async function assignSeat(req, res) {
  const { id } = req.params; // licenseId
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User selection is required.' });
  }

  try {
    const license = await prisma.license.findUnique({
      where: { id: Number(id) },
      include: {
        assignments: { where: { revokedAt: null } }
      }
    });

    if (!license) {
      return res.status(404).json({ error: 'License subscription not found.' });
    }

    // Check seat availability
    if (license.assignments.length >= license.totalSeats) {
      return res.status(400).json({ error: `Seat allocation failed: All ${license.totalSeats} seats are already occupied.` });
    }

    // Check if user already assigned
    const alreadyAssigned = license.assignments.some(a => a.userId === Number(userId));
    if (alreadyAssigned) {
      return res.status(400).json({ error: 'User is already allocated a seat for this software subscription.' });
    }

    const assignment = await prisma.licenseAssignment.create({
      data: {
        licenseId: license.id,
        userId: Number(userId)
      }
    });

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to allocate subscription seat: ' + error.message });
  }
}

async function revokeSeat(req, res) {
  const { id } = req.params; // licenseId
  const { userId } = req.body;

  try {
    await prisma.licenseAssignment.deleteMany({
      where: {
        licenseId: Number(id),
        userId: Number(userId)
      }
    });

    res.json({ success: true, message: 'License subscription seat revoked successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke seat assignment: ' + error.message });
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  assignSeat,
  revokeSeat
};
