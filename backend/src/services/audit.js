const prisma = require('../config/prisma');

// Fire-and-forget audit trail writer. Never blocks or fails the main request.
async function logAudit({ userId, action, entity, entityId, before, after, ip }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity,
        entityId: entityId != null ? String(entityId) : null,
        before: before ?? undefined,
        after: after ?? undefined,
        ip: ip ?? null,
      },
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAudit };
