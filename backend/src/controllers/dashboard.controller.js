const prisma = require('../config/prisma');
const config = require('../config');
const { sendMail, layout } = require('../services/email');

async function stats(_req, res) {
  const now = new Date();
  const soon = (d) => new Date(now.getTime() + d * 86400000);

  const [byStatus, byCategory, byDepartment, byLocation, warrantyExpiring, licenseExpiring, openRepairs, stockItems, totalUsers] = await Promise.all([
    prisma.asset.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.asset.groupBy({ by: ['categoryId'], _count: { _all: true } }),
    prisma.asset.groupBy({ by: ['departmentId'], _count: { _all: true } }),
    prisma.asset.groupBy({ by: ['locationId'], _count: { _all: true } }),
    prisma.asset.count({ where: { warrantyEnd: { gte: now, lte: soon(config.warrantyAlertDays) }, status: { notIn: ['DISPOSED', 'LOST'] } } }),
    prisma.license.count({ where: { expiryDate: { gte: now, lte: soon(config.licenseAlertDays) } } }),
    prisma.repairTicket.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.stockItem.findMany(),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  const [categories, departments, locations] = await Promise.all([
    prisma.category.findMany(), prisma.department.findMany(), prisma.location.findMany(),
  ]);
  const nameOf = (list, id, fallback = 'Unassigned') => list.find((x) => x.id === id)?.name || fallback;

  const statusCount = (s) => byStatus.find((g) => g.status === s)?._count._all || 0;
  res.json({
    totals: {
      total: byStatus.reduce((a, g) => a + g._count._all, 0),
      available: statusCount('AVAILABLE'),
      assigned: statusCount('ASSIGNED'),
      faulty: statusCount('FAULTY'),
      repair: statusCount('REPAIR'),
      lost: statusCount('LOST'),
      disposed: statusCount('DISPOSED'),
      warrantyExpiring, licenseExpiring, openRepairs,
      lowStock: stockItems.filter((s) => s.quantity <= s.minQuantity).length,
      users: totalUsers,
    },
    byCategory: byCategory.map((g) => ({ name: nameOf(categories, g.categoryId), count: g._count._all })),
    byDepartment: byDepartment.map((g) => ({ name: nameOf(departments, g.departmentId), count: g._count._all })),
    byLocation: byLocation.map((g) => ({ name: nameOf(locations, g.locationId), count: g._count._all })),
  });
}

async function sendAckEmail(req, res) {
  const { employeeEmail, employeeName, assets } = req.body;
  if (!employeeEmail || !employeeName) {
    return res.status(400).json({ error: 'employeeEmail and employeeName are required' });
  }

  const assetsRows = (assets || []).map(a => `
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; color: #4f46e5;">${a.assetId || '—'}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${a.category || '—'}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${a.manufacturer || ''} ${a.model || ''}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; font-family: monospace;">${a.serialNumber || '—'}</td>
    </tr>
  `).join('');

  const html = layout('📄 IT Asset Handover Acknowledgement Request', `
    <p>Dear <b>${employeeName}</b>,</p>
    <p>Please find below the list of IT hardware assets currently provisioned and assigned to you by Nationwide Paper Ltd IT Department:</p>
    
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 16px; font-size: 13px;">
      <thead>
        <tr style="background-color: #f3f4f6; text-align: left;">
          <th style="padding: 8px; border: 1px solid #e5e7eb;">Asset Tag</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb;">Category</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb;">Model / Specs</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb;">Serial Number</th>
        </tr>
      </thead>
      <tbody>
        ${assetsRows || '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #9ca3af; font-style: italic;">No active assets currently assigned.</td></tr>'}
      </tbody>
    </table>

    <p style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; font-size: 12px; color: #78350f;">
      <b>Acknowledgement Declaration:</b> By receiving this email, you verify the listed serial numbers and confirm receipt. 
      Please reply directly to this email or contact the IT Department if there are any discrepancies.
    </p>
    
    <p style="margin-top: 24px;">Regards,<br/><b>IT Department</b><br/>Nationwide Paper Ltd</p>
  `);

  const subject = `[IT Asset Acknowledgement] Assigned Equipment Verification — ${employeeName}`;
  await sendMail({
    to: employeeEmail,
    cc: config.itManagerEmail || undefined,
    subject,
    html,
  });

  res.json({ success: true, message: `Acknowledgement email sent to ${employeeEmail}!` });
}

module.exports = { stats, sendAckEmail };
