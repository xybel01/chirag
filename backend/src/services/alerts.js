const cron = require('node-cron');
const prisma = require('../config/prisma');
const config = require('../config');
const { sendMail, layout } = require('./email');
const { notifyTeams } = require('./teams');

// Daily scheduled job: warranty expiry, license expiry, low stock.
async function runAlerts() {
  const now = new Date();
  const inDays = (d) => new Date(now.getTime() + d * 86400000);

  const warranties = await prisma.asset.findMany({
    where: { warrantyEnd: { gte: now, lte: inDays(config.warrantyAlertDays) }, status: { notIn: ['DISPOSED', 'LOST'] } },
    include: { category: true, assignedTo: true },
  });
  const licenses = await prisma.license.findMany({
    where: { expiryDate: { gte: now, lte: inDays(config.licenseAlertDays) } },
  });
  const allStock = await prisma.stockItem.findMany();
  const lowStock = allStock.filter((s) => s.quantity <= s.minQuantity);

  if (!warranties.length && !licenses.length && !lowStock.length) return;

  // Auto-create ITSM ticket for expired warranties
  try {
    const expiredWarranties = await prisma.asset.findMany({
      where: {
        warrantyEnd: { lte: now },
        status: { notIn: ['DISPOSED', 'LOST'] },
        linkedTickets: {
          none: {
            summary: { contains: 'Warranty Expired' }
          }
        }
      }
    });

    for (const asset of expiredWarranties) {
      const count = await prisma.ticket.count({ where: { type: 'INCIDENT' } });
      const ticketNo = `INC-${String(count + 1).padStart(6, '0')}`;

      await prisma.ticket.create({
        data: {
          ticketNo,
          type: 'INCIDENT',
          summary: `Warranty Expired: ${asset.assetTag}`,
          description: `Automatic system alert: The warranty for asset ${asset.assetTag} (${asset.manufacturer} ${asset.model}) has expired. Review for renewal or replacement.`,
          priority: 'MEDIUM',
          status: 'NEW',
          requesterId: 1, // default system admin
          linkedAssets: {
            connect: { id: asset.id }
          }
        }
      });
    }
  } catch (err) {
    console.error('Failed to auto-create tickets for expired warranties:', err);
  }

  const section = (title, lines) => (lines.length ? `<h4>${title}</h4><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>` : '');
  const html = layout('Daily IT Inventory Alerts',
    section(`Warranties expiring within ${config.warrantyAlertDays} days`, warranties.map((a) =>
      `${a.assetTag} — ${a.manufacturer} ${a.model} (expires ${a.warrantyEnd.toISOString().slice(0, 10)})`)) +
    section(`Licenses expiring within ${config.licenseAlertDays} days`, licenses.map((l) =>
      `${l.name} (expires ${l.expiryDate.toISOString().slice(0, 10)})`)) +
    section('Low stock items', lowStock.map((s) => `${s.name}: ${s.quantity} left (min ${s.minQuantity})`))
  );

  if (config.itManagerEmail) await sendMail({ to: config.itManagerEmail, subject: '[IT Inventory] Daily expiry & stock alerts', html });
  await notifyTeams('IT Inventory Daily Alerts',
    `${warranties.length} warranty expiries, ${licenses.length} license expiries, ${lowStock.length} low stock items.`,
    [['Warranties', warranties.length], ['Licenses', licenses.length], ['Low stock', lowStock.length]]);
}

function startAlertScheduler() {
  cron.schedule(config.alertCron, () => runAlerts().catch((e) => console.error('Alert job failed:', e)));
  console.log(`Alert scheduler running (cron: ${config.alertCron})`);
}

module.exports = { startAlertScheduler, runAlerts };
