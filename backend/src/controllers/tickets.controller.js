const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * List all tickets with SLA indicators & filters
 */
async function list(req, res) {
  try {
    const { status, priority, type, q } = req.query;

    const where = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }
    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (q) {
      where.OR = [
        { ticketNo: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        linkedAssets: { select: { id: true, assetTag: true, model: true, serialNumber: true } },
        _count: { select: { comments: true, workLogs: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const allTickets = await prisma.ticket.findMany({ select: { status: true, priority: true } });
    const counts = {
      total: allTickets.length,
      open: allTickets.filter(t => ['NEW', 'OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length,
      pending: allTickets.filter(t => ['PENDING_USER', 'PENDING_VENDOR', 'PENDING_APPROVAL'].includes(t.status)).length,
      resolved: allTickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length,
      critical: allTickets.filter(t => t.priority === 'CRITICAL' && !['RESOLVED', 'CLOSED'].includes(t.status)).length
    };

    return res.json({ counts, tickets });
  } catch (error) {
    console.error('Error in tickets.list:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get ticket details with conversation history & worklogs
 */
async function getById(req, res) {
  try {
    const { id } = req.params;
    const where = !isNaN(Number(id)) ? { id: Number(id) } : { ticketNo: id };

    const ticket = await prisma.ticket.findFirst({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        category: true,
        linkedAssets: true,
        comments: {
          include: { author: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        },
        workLogs: {
          include: { technician: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    return res.json({ ticket });
  } catch (error) {
    console.error('Error in tickets.getById:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Create a new ticket
 */
async function create(req, res) {
  try {
    const { summary, description, priority = 'MEDIUM', type = 'INCIDENT', categoryId, assignedToId, assetId } = req.body;
    if (!summary || !description) {
      return res.status(400).json({ error: 'Summary and description are required' });
    }

    const count = await prisma.ticket.count();
    const prefix = type === 'SERVICE_REQUEST' ? 'SR' : (type === 'CHANGE_REQUEST' ? 'CHG' : 'INC');
    const ticketNo = `${prefix}-${String(count + 1).padStart(6, '0')}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNo,
        type,
        summary,
        description,
        priority,
        status: 'OPEN',
        requesterId: req.user.id,
        assignedToId: assignedToId ? Number(assignedToId) : null,
        categoryId: categoryId ? Number(categoryId) : null,
        linkedAssets: assetId ? { connect: [{ id: Number(assetId) }] } : undefined
      },
      include: {
        requester: true,
        assignedTo: true,
        category: true,
        linkedAssets: true
      }
    });

    return res.status(201).json({ success: true, ticket });
  } catch (error) {
    console.error('Error in tickets.create:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Add a comment / note to ticket
 */
async function addComment(req, res) {
  try {
    const { id } = req.params;
    const { body, isInternal = false } = req.body;

    if (!body) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    const ticketId = Number(id);
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        authorId: req.user.id,
        body,
        isInternal: Boolean(isInternal)
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    // If ticket was in pending, flip to open
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() }
    });

    return res.status(201).json({ success: true, comment });
  } catch (error) {
    console.error('Error in tickets.addComment:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Update ticket status, priority, or assignee
 */
async function update(req, res) {
  try {
    const { id } = req.params;
    const { status, priority, assignedToId } = req.body;

    const data = {};
    if (status) data.status = status;
    if (priority) data.priority = priority;
    if (assignedToId !== undefined) data.assignedToId = assignedToId ? Number(assignedToId) : null;

    if (status === 'RESOLVED') {
      data.resolvedAt = new Date();
    } else if (status === 'CLOSED') {
      data.closedAt = new Date();
    }

    const updated = await prisma.ticket.update({
      where: { id: Number(id) },
      data,
      include: {
        requester: true,
        assignedTo: true
      }
    });

    return res.json({ success: true, ticket: updated });
  } catch (error) {
    console.error('Error in tickets.update:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Add worklog time tracking
 */
async function addWorklog(req, res) {
  try {
    const { id } = req.params;
    const { timeSpent, notes } = req.body;

    if (!timeSpent) {
      return res.status(400).json({ error: 'timeSpent in minutes is required' });
    }

    const workLog = await prisma.workLog.create({
      data: {
        ticketId: Number(id),
        technicianId: req.user.id,
        timeSpent: Number(timeSpent),
        notes: notes || 'Troubleshooting and resolution'
      },
      include: {
        technician: { select: { id: true, name: true, email: true } }
      }
    });

    return res.status(201).json({ success: true, workLog });
  } catch (error) {
    console.error('Error in tickets.addWorklog:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Atera AI Copilot (ActionIT) for Tickets
 */
async function aiCopilot(req, res) {
  try {
    const { id } = req.params;
    const { promptType = 'SUGGEST_SOLUTION' } = req.body; // 'SUGGEST_SOLUTION' | 'SUMMARIZE' | 'DRAFT_REPLY'

    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(id) },
      include: {
        linkedAssets: true,
        comments: { take: 5, orderBy: { createdAt: 'desc' } }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    let response = {};

    if (promptType === 'SUMMARIZE') {
      response = {
        title: 'AI Ticket Summary',
        content: `Issue involves ${ticket.summary}. The requester reported: "${ticket.description.slice(0, 150)}...". Priority is set to ${ticket.priority}. No critical blockers currently logged.`
      };
    } else if (promptType === 'DRAFT_REPLY') {
      response = {
        title: 'Draft Customer Response',
        content: `Hi there,\n\nThank you for reaching out to the IT Support desk regarding "${ticket.summary}".\n\nOur engineering team has reviewed your request and is currently investigating the telemetry logs. We have applied initial remediation steps and will provide a status update shortly.\n\nPlease let us know if the issue persists or if you experience any other symptoms.\n\nBest regards,\nIT Service Operations`
      };
    } else {
      // Suggest Solution & Recommended Scripts
      const scriptSuggestions = [];
      const lower = (ticket.summary + ' ' + ticket.description).toLowerCase();
      if (lower.includes('slow') || lower.includes('disk') || lower.includes('space')) {
        scriptSuggestions.push('Clear Windows Temp Files & Cache');
        scriptSuggestions.push('Run System File Checker (SFC /scannow)');
      }
      if (lower.includes('net') || lower.includes('dns') || lower.includes('internet') || lower.includes('wifi')) {
        scriptSuggestions.push('Flush DNS & Reset TCP/IP Stack');
      }
      if (lower.includes('print') || lower.includes('spooler')) {
        scriptSuggestions.push('Restart Print Spooler Service');
      }
      if (lower.includes('virus') || lower.includes('malware') || lower.includes('defender')) {
        scriptSuggestions.push('Run Windows Defender Quick Scan');
      }

      response = {
        title: 'Atera AI Recommended Actions & Remediation',
        diagnosis: `Automated diagnostic analysis for [${ticket.ticketNo}]: ${ticket.summary}`,
        recommendedSteps: [
          'Verify device connectivity and recent telemetry metrics.',
          'Review background processes consuming memory/CPU.',
          scriptSuggestions.length ? `Recommended automated script: ${scriptSuggestions[0]}` : 'Run basic connectivity and system diagnostic scan.'
        ],
        recommendedScripts: scriptSuggestions
      };
    }

    return res.json({ success: true, ai: response });
  } catch (error) {
    console.error('Error in tickets.aiCopilot:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  list,
  getById,
  create,
  addComment,
  update,
  addWorklog,
  aiCopilot
};
