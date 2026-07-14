const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list(req, res) {
  const userId = req.user.id;
  try {
    // Return approvals that need current user action
    const items = await prisma.approval.findMany({
      where: {
        steps: {
          some: {
            approverId: userId,
            status: 'PENDING'
          }
        }
      },
      include: {
        ticket: { select: { id: true, ticketNo: true, summary: true, requester: { select: { name: true } } } },
        steps: { include: { approver: { select: { id: true, name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function create(req, res) {
  const { ticketId, title, approverIds } = req.body; // Array of IDs representing multi-level approval steps

  if (!ticketId || !approverIds || approverIds.length === 0) {
    return res.status(400).json({ error: 'ticketId and approverIds are required.' });
  }

  try {
    const approval = await prisma.approval.create({
      data: {
        ticketId: Number(ticketId),
        title,
        status: 'PENDING'
      }
    });

    const steps = approverIds.map((approverId) => {
      return prisma.approvalStep.create({
        data: {
          approvalId: approval.id,
          approverId: Number(approverId),
          status: 'PENDING'
        }
      });
    });
    await Promise.all(steps);

    // Update ticket status to PENDING_APPROVAL
    await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: { status: 'PENDING_APPROVAL' }
    });

    res.status(201).json(approval);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function action(req, res) {
  const { stepId } = req.params;
  const { action, comments } = req.body; // 'APPROVED' | 'REJECTED'
  const userId = req.user.id;

  try {
    const step = await prisma.approvalStep.findUnique({
      where: { id: Number(stepId) },
      include: { approval: { include: { steps: true } } }
    });

    if (!step) {
      return res.status(404).json({ error: 'Approval step not found' });
    }

    if (step.approverId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You are not the assigned approver for this step.' });
    }

    // Update current step
    const updatedStep = await prisma.approvalStep.update({
      where: { id: Number(stepId) },
      data: {
        status: action,
        comments,
        actionedAt: new Date()
      }
    });

    const allSteps = step.approval.steps;
    // Map current step's new status in list
    const stepIdx = allSteps.findIndex(s => s.id === Number(stepId));
    allSteps[stepIdx].status = action;

    let nextApprovalStatus = 'PENDING';
    if (action === 'REJECTED') {
      nextApprovalStatus = 'REJECTED';
    } else if (allSteps.every(s => s.status === 'APPROVED')) {
      nextApprovalStatus = 'APPROVED';
    }

    if (nextApprovalStatus !== 'PENDING') {
      // Update overall approval record status
      await prisma.approval.update({
        where: { id: step.approvalId },
        data: { status: nextApprovalStatus }
      });

      // Update ticket status
      await prisma.ticket.update({
        where: { id: step.approval.ticketId },
        data: { status: nextApprovalStatus === 'APPROVED' ? 'OPEN' : 'CANCELLED' }
      });
    }

    res.json(updatedStep);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { list, create, action };
