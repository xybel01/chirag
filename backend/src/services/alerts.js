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
  const allStock = await prisma.stockItem.findMany();
  const lowStock = allStock.filter((s) => s.quantity <= s.minQuantity);

  if (!warranties.length && !lowStock.length) return;

  const section = (title, lines) => (lines.length ? `<h4>${title}</h4><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>` : '');
  const html = layout('Daily IT Inventory Alerts',
    section(`Warranties expiring within ${config.warrantyAlertDays} days`, warranties.map((a) =>
      `${a.assetTag} — ${a.manufacturer} ${a.model} (expires ${a.warrantyEnd.toISOString().slice(0, 10)})`)) +
    section('Low stock items', lowStock.map((s) => `${s.name}: ${s.quantity} left (min ${s.minQuantity})`))
  );

  if (config.itManagerEmail) await sendMail({ to: config.itManagerEmail, subject: '[IT Inventory] Daily expiry & stock alerts', html });
  await notifyTeams('IT Inventory Daily Alerts',
    `${warranties.length} warranty expiries, ${lowStock.length} low stock items.`,
    [['Warranties', warranties.length], ['Low stock', lowStock.length]]);
}

function startAlertScheduler() {
  cron.schedule(config.alertCron, () => runAlerts().catch((e) => console.error('Alert job failed:', e)));
  console.log(`Alert scheduler running (cron: ${config.alertCron})`);
}

module.exports = { startAlertScheduler, runAlerts };
