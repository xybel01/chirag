const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list(req, res) {
  const { role, id: userId, departmentId } = req.user;
  const { type, status, priority, search, page = 1, pageSize = 20 } = req.query;

  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  // Role-Based Filtering
  // Employee: Only own requests or affected user tickets
  // Department Manager: Requests raised by their team (same department)
  // IT support / admin: All tickets
  let roleWhere = {};
  if (role === 'EMPLOYEE') {
    roleWhere = {
      OR: [
        { requesterId: userId },
        { affectedUserId: userId }
      ]
    };
  } else if (role === 'DEPARTMENT_MANAGER' && departmentId) {
    roleWhere = {
      OR: [
        { departmentId: departmentId },
        { requesterId: userId }
      ]
    };
  }

  // Filter params
  const where = {
    ...roleWhere,
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(search ? {
      OR: [
        { ticketNo: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };

  try {
    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          requester: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          category: true,
          approvals: { include: { steps: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.ticket.count({ where })
    ]);

    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets: ' + error.message });
  }
}

async function get(req, res) {
  const { id } = req.params;
  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { id: /^\d+$/.test(id) ? Number(id) : undefined },
          { ticketNo: id }
        ].filter(Boolean)
      },
      include: {
        requester: true,
        affectedUser: true,
        category: true,
        assignedTo: true,
        comments: {
          include: { author: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        },
        attachments: true,
        watchers: { include: { user: { select: { id: true, name: true, email: true } } } },
        workLogs: { include: { technician: { select: { id: true, name: true } } } },
        approvals: { include: { steps: { include: { approver: { select: { id: true, name: true } } } } } },
        linkedAssets: true,
        surveys: true,
        customValues: { include: { customField: true } },
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve ticket: ' + error.message });
  }
}

async function create(req, res) {
  const { type, summary, description, priority, categoryId, affectedUserId, customFields } = req.body;
  const requesterId = req.user.id;

  try {
    // 1. Generate Ticket Number (INC-XXXXXX, SR-XXXXXX, CHG-XXXXXX)
    const typePrefixes = {
      INCIDENT: 'INC',
      SERVICE_REQUEST: 'SR',
      CHANGE_REQUEST: 'CHG',
      PROBLEM: 'PRB'
    };
    const prefix = typePrefixes[type] || 'TKT';
    const count = await prisma.ticket.count({ where: { type } });
    const ticketNo = `${prefix}-${String(count + 1).padStart(6, '0')}`;

    // 2. Resolve SLA policy response and resolution time targets
    const slaPolicy = await prisma.sLA.findFirst({
      where: { priority, type, isActive: true }
    }) || await prisma.sLA.findFirst({
      where: { priority, isActive: true }
    });

    const now = new Date();
    const slaResponseExpiry = slaPolicy ? new Date(now.getTime() + slaPolicy.responseTimeMins * 60000) : null;
    const slaResolutionExpiry = slaPolicy ? new Date(now.getTime() + slaPolicy.resolutionTimeMins * 60000) : null;

    // 3. Create Ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketNo,
        type,
        summary,
        description,
        priority: priority || 'MEDIUM',
        status: 'NEW',
        requesterId,
        affectedUserId: affectedUserId ? Number(affectedUserId) : requesterId,
        departmentId: req.user.departmentId,
        categoryId: categoryId ? Number(categoryId) : null,
        slaStatus: 'WITHIN_SLA',
        slaResponseExpiry,
        slaResolutionExpiry,
        dueAt: slaResolutionExpiry,
      }
    });

    // 4. Create Custom Field Values if present
    if (customFields && typeof customFields === 'object') {
      const operations = Object.entries(customFields).map(([fieldId, val]) => {
        return prisma.customFieldValue.create({
          data: {
            customFieldId: Number(fieldId),
            ticketId: ticket.id,
            value: String(val),
          }
        });
      });
      await Promise.all(operations);
    }

    // 5. Evaluate no-code automation rules for triggers (TICKET_CREATED)
    await evaluateAutomationRules('TICKET_CREATED', ticket);

    // Notify the IT Helpdesk Team via Email
    try {
      const config = require('../config');
      const { sendMail, layout } = require('../services/email');
      const category = ticket.categoryId ? await prisma.category.findUnique({ where: { id: ticket.categoryId } }) : null;
      const categoryName = category ? category.name : 'General IT Helpdesk';
      const mailBody = `
        <p>A new IT Service ticket has been generated on the Nationwide Paper Ltd Portal:</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 10px; font-size:13px;">
          <tr><td style="padding:5px 0; font-weight:bold; width:120px; border-bottom:1px solid #f3f4f6;">Ticket No:</td><td style="padding:5px 0; border-bottom:1px solid #f3f4f6; color:#1e3a5f; font-weight:bold;">${ticket.ticketNo}</td></tr>
          <tr><td style="padding:5px 0; font-weight:bold; border-bottom:1px solid #f3f4f6;">Type:</td><td style="padding:5px 0; border-bottom:1px solid #f3f4f6;">${ticket.type}</td></tr>
          <tr><td style="padding:5px 0; font-weight:bold; border-bottom:1px solid #f3f4f6;">Priority:</td><td style="padding:5px 0; border-bottom:1px solid #f3f4f6;">${ticket.priority}</td></tr>
          <tr><td style="padding:5px 0; font-weight:bold; border-bottom:1px solid #f3f4f6;">Category:</td><td style="padding:5px 0; border-bottom:1px solid #f3f4f6;">${categoryName}</td></tr>
          <tr><td style="padding:5px 0; font-weight:bold; border-bottom:1px solid #f3f4f6;">Summary:</td><td style="padding:5px 0; border-bottom:1px solid #f3f4f6;">${ticket.summary}</td></tr>
          <tr><td style="padding:5px 0; font-weight:bold; border-bottom:1px solid #f3f4f6;">Description:</td><td style="padding:5px 0; border-bottom:1px solid #f3f4f6; color:#4b5563;">${ticket.description}</td></tr>
          <tr><td style="padding:5px 0; font-weight:bold; border-bottom:1px solid #f3f4f6;">Requester:</td><td style="padding:5px 0; border-bottom:1px solid #f3f4f6;">${req.user.name} (${req.user.email})</td></tr>
        </table>
        <p style="margin-top: 20px;"><a href="${config.appUrl || 'http://localhost:5173'}/tickets/${ticket.ticketNo}" style="background:#1e3a5f; color:#fff; padding:10px 20px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">Open Ticket in Portal</a></p>
      `;
      await sendMail({
        to: 'it@nationwide-paper.com',
        subject: `[${ticket.ticketNo}] New IT Ticket Created: ${ticket.summary}`,
        html: layout(`New Ticket Opened`, mailBody)
      });
    } catch (mailErr) {
      console.error('Failed to send email alert:', mailErr.message);
    }

    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ticket: ' + error.message });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { status, priority, assignedToId, summary, description, categoryId, linkedAssetsIds } = req.body;

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { id: /^\d+$/.test(id) ? Number(id) : undefined },
          { ticketNo: id }
        ].filter(Boolean)
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const before = { ...ticket };

    // Prepare update payload
    const updateData = {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assignedToId ? { assignedToId: Number(assignedToId) } : {}),
      ...(summary ? { summary } : {}),
      ...(description ? { description } : {}),
      ...(categoryId ? { categoryId: Number(categoryId) } : {}),
    };

    // If assigned to technician, move status to ASSIGNED if currently NEW
    if (assignedToId && ticket.status === 'NEW') {
      updateData.status = 'ASSIGNED';
    }

    // If resolved, register resolution date and check SLA
    if (status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
      const isBreached = ticket.slaResolutionExpiry && new Date() > ticket.slaResolutionExpiry;
      updateData.slaStatus = isBreached ? 'BREACHED' : 'WITHIN_SLA';
    }

    // Handle Asset linkages
    if (linkedAssetsIds && Array.isArray(linkedAssetsIds)) {
      updateData.linkedAssets = {
        set: linkedAssetsIds.map(assetId => ({ id: Number(assetId) }))
      };
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: updateData,
      include: { assignedTo: true, requester: true }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE',
        entity: 'Ticket',
        entityId: String(ticket.id),
        before,
        after: updated,
        ip: req.ip || '127.0.0.1',
      }
    });

    // Evaluate Automation rules
    if (status && before.status !== status) {
      await evaluateAutomationRules('STATUS_CHANGED', updated);
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket: ' + error.message });
  }
}

async function addComment(req, res) {
  const { id } = req.params;
  const { body, isInternal } = req.body;
  const authorId = req.user.id;

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { id: /^\d+$/.test(id) ? Number(id) : undefined },
          { ticketNo: id }
        ].filter(Boolean)
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId,
        body,
        isInternal: !!isInternal
      },
      include: { author: { select: { id: true, name: true, role: true } } }
    });

    // If customer replies, set status to OPEN if it was PENDING_USER
    if (req.user.role === 'EMPLOYEE' && ticket.status === 'PENDING_USER') {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'OPEN' }
      });
    }

    // Trigger automations
    await evaluateAutomationRules('COMMENT_ADDED', ticket);

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment: ' + error.message });
  }
}

async function logWork(req, res) {
  const { id } = req.params;
  const { timeSpent, notes } = req.body;
  const technicianId = req.user.id;

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { id: /^\d+$/.test(id) ? Number(id) : undefined },
          { ticketNo: id }
        ].filter(Boolean)
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const log = await prisma.workLog.create({
      data: {
        ticketId: ticket.id,
        technicianId,
        timeSpent: Number(timeSpent),
        notes
      },
      include: { technician: { select: { id: true, name: true } } }
    });

    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log work: ' + error.message });
  }
}

async function addWatcher(req, res) {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { id: /^\d+$/.test(id) ? Number(id) : undefined },
          { ticketNo: id }
        ].filter(Boolean)
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const watcher = await prisma.ticketWatcher.create({
      data: {
        ticketId: ticket.id,
        userId: Number(userId)
      },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    res.status(201).json(watcher);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add watcher: ' + error.message });
  }
}

async function removeWatcher(req, res) {
  const { id, userId } = req.params;

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { id: /^\d+$/.test(id) ? Number(id) : undefined },
          { ticketNo: id }
        ].filter(Boolean)
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await prisma.ticketWatcher.deleteMany({
      where: { ticketId: ticket.id, userId: Number(userId) }
    });

    res.json({ success: true, message: 'Watcher removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove watcher: ' + error.message });
  }
}

async function submitSurvey(req, res) {
  const { id } = req.params;
  const { rating, resolutionQuality, technicianBehavior, responseTimeRating, comments } = req.body;

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { id: /^\d+$/.test(id) ? Number(id) : undefined },
          { ticketNo: id }
        ].filter(Boolean)
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const survey = await prisma.survey.create({
      data: {
        ticketId: ticket.id,
        rating: Number(rating),
        resolutionQuality: Number(resolutionQuality),
        technicianBehavior: Number(technicianBehavior),
        responseTimeRating: Number(responseTimeRating),
        comments
      }
    });

    res.status(201).json(survey);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit feedback: ' + error.message });
  }
}

// Helper: No-Code Automation engine core evaluator
async function evaluateAutomationRules(trigger, ticket) {
  try {
    const rules = await prisma.automationRule.findMany({ where: { isActive: true, trigger } });
    for (const rule of rules) {
      const conditions = rule.conditions; // JSON object e.g. { "priority": "CRITICAL" }
      const actions = rule.actions; // JSON object e.g. { "status": "ASSIGNED", "assignTo": 3 }

      // Check conditions
      let match = true;
      for (const [key, val] of Object.entries(conditions)) {
        if (String(ticket[key]) !== String(val)) {
          match = false;
          break;
        }
      }

      if (match) {
        // Execute actions
        const dataToUpdate = {};
        if (actions.status) dataToUpdate.status = actions.status;
        if (actions.assignTo) dataToUpdate.assignedToId = Number(actions.assignTo);
        if (actions.priority) dataToUpdate.priority = actions.priority;

        if (Object.keys(dataToUpdate).length > 0) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: dataToUpdate
          });
        }

        // Action: Add internal note
        if (actions.internalNote) {
          await prisma.ticketComment.create({
            data: {
              ticketId: ticket.id,
              authorId: 1, // system user / superadmin
              body: String(actions.internalNote),
              isInternal: true
            }
          });
        }
      }
    }
  } catch (err) {
    console.error('Automation Engine Error:', err);
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  addComment,
  logWork,
  addWatcher,
  removeWatcher,
  submitSurvey
};
