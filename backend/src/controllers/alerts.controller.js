const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * List all monitoring alerts
 */
async function list(req, res) {
  try {
    const { status, severity, category } = req.query;

    const where = {};
    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }
    if (severity && severity !== 'ALL') {
      where.severity = severity.toUpperCase();
    }
    if (category && category !== 'ALL') {
      where.category = category.toUpperCase();
    }

    const alerts = await prisma.deviceAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const counts = {
      total: alerts.length,
      open: alerts.filter(a => a.status === 'OPEN').length,
      critical: alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'OPEN').length,
      warning: alerts.filter(a => a.severity === 'WARNING' && a.status === 'OPEN').length,
      resolved: alerts.filter(a => a.status === 'RESOLVED').length
    };

    return res.json({ counts, alerts });
  } catch (error) {
    console.error('Error in alerts.list:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Acknowledge an alert
 */
async function acknowledge(req, res) {
  try {
    const { id } = req.params;
    const alert = await prisma.deviceAlert.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED' }
    });
    return res.json({ success: true, alert });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Resolve an alert
 */
async function resolve(req, res) {
  try {
    const { id } = req.params;
    const alert = await prisma.deviceAlert.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date() }
    });
    return res.json({ success: true, alert });
  } catch (error) {
    console.error('Error resolving alert:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Create an ITSM Ticket directly from an Alert
 */
async function createTicketFromAlert(req, res) {
  try {
    const { id } = req.params;
    const alert = await prisma.deviceAlert.findUnique({ where: { id } });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Find linked asset if possible
    const asset = await prisma.asset.findUnique({ where: { serialNumber: alert.serialNumber } });
    const user = req.user;

    // Generate ticket number
    const count = await prisma.ticket.count();
    const ticketNo = `INC-${String(count + 1).padStart(6, '0')}`;

    const priorityMap = {
      CRITICAL: 'CRITICAL',
      WARNING: 'HIGH',
      INFO: 'MEDIUM'
    };

    const ticket = await prisma.ticket.create({
      data: {
        ticketNo,
        type: 'INCIDENT',
        summary: `[Alert] ${alert.title} on ${alert.deviceName}`,
        description: `Automated incident created from RMM Monitoring Alert.\n\nDevice: ${alert.deviceName} (${alert.serialNumber})\nSeverity: ${alert.severity}\nCategory: ${alert.category}\nDetails: ${alert.description}\nDetected At: ${alert.createdAt.toISOString()}`,
        priority: priorityMap[alert.severity] || 'HIGH',
        status: 'OPEN',
        requesterId: user.id,
        linkedAssets: asset ? { connect: [{ id: asset.id }] } : undefined
      }
    });

    // Mark alert acknowledged and link ticket
    await prisma.deviceAlert.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED', ticketId: ticket.id }
    });

    return res.json({
      success: true,
      message: `Ticket ${ticket.ticketNo} created successfully`,
      ticket
    });
  } catch (error) {
    console.error('Error creating ticket from alert:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  list,
  acknowledge,
  resolve,
  createTicketFromAlert
};
