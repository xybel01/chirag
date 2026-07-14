const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==========================================
// USER ONBOARDING
// ==========================================

async function listOnboarding(req, res) {
  try {
    const items = await prisma.onboardingRequest.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createOnboarding(req, res) {
  const { employeeName, personalEmail, jobTitle, departmentId, reportingManager, joiningDate, officeLocation, assetsNeeded } = req.body;
  try {
    const request = await prisma.onboardingRequest.create({
      data: {
        employeeName,
        personalEmail,
        jobTitle,
        departmentId: Number(departmentId),
        reportingManager,
        joiningDate: new Date(joiningDate),
        officeLocation,
        assetsNeeded: assetsNeeded || {},
      }
    });

    // Automatically generate onboarding service requests (tickets) for HR and IT:
    // HR task
    await prisma.ticket.create({
      data: {
        ticketNo: `SR-ONB-HR-${Date.now().toString().slice(-4)}`,
        type: 'SERVICE_REQUEST',
        summary: `HR Onboarding Profile Setup: ${employeeName}`,
        description: `Please verify and finalize HR enrollment forms for joining employee ${employeeName} (${jobTitle}). Personal Email: ${personalEmail}. Joining date: ${joiningDate}.`,
        priority: 'MEDIUM',
        status: 'NEW',
        requesterId: req.user.id,
      }
    });

    // IT Provisioning task
    await prisma.ticket.create({
      data: {
        ticketNo: `SR-ONB-IT-${Date.now().toString().slice(-4)}`,
        type: 'SERVICE_REQUEST',
        summary: `IT Account & Software Provisioning: ${employeeName}`,
        description: `Set up Active Directory / M365 account, assign licenses, VPN, and prepare asset bundles (Laptops, Monitors, and Accessories) for ${employeeName} joining on ${joiningDate} in ${officeLocation}.`,
        priority: 'HIGH',
        status: 'NEW',
        requesterId: req.user.id,
      }
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function completeOnboarding(req, res) {
  const { id } = req.params;
  try {
    const request = await prisma.onboardingRequest.update({
      where: { id: Number(id) },
      data: { status: 'COMPLETED' }
    });
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// USER OFFBOARDING
// ==========================================

async function listOffboarding(req, res) {
  try {
    const items = await prisma.offboardingRequest.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createOffboarding(req, res) {
  const { userId, lastWorkingDate, disableAccount, returnAssets } = req.body;
  try {
    const request = await prisma.offboardingRequest.create({
      data: {
        userId: Number(userId),
        lastWorkingDate: new Date(lastWorkingDate),
        disableAccount: !!disableAccount,
        returnAssets: !!returnAssets,
        status: 'PENDING'
      }
    });

    const offboardedUser = await prisma.user.findUnique({ where: { id: Number(userId) } });

    // Automatically create account de-provisioning ticket
    await prisma.ticket.create({
      data: {
        ticketNo: `SR-OFF-${Date.now().toString().slice(-4)}`,
        type: 'SERVICE_REQUEST',
        summary: `User Offboarding Session Revocation: ${offboardedUser?.name}`,
        description: `Please process offboarding for employee ${offboardedUser?.name} (${offboardedUser?.email}). Last working date: ${lastWorkingDate}. Requirements: Disable account: ${disableAccount}, Asset return checklist: ${returnAssets}.`,
        priority: 'HIGH',
        status: 'NEW',
        requesterId: req.user.id,
      }
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function completeOffboarding(req, res) {
  const { id } = req.params;
  try {
    const request = await prisma.offboardingRequest.findUnique({ where: { id: Number(id) } });
    if (!request) return res.status(404).json({ error: 'Offboarding request not found' });

    // Update status
    const updated = await prisma.offboardingRequest.update({
      where: { id: Number(id) },
      data: { status: 'COMPLETED' }
    });

    // Automatically disable user account
    if (request.disableAccount) {
      await prisma.user.update({
        where: { id: request.userId },
        data: { isActive: false }
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listOnboarding,
  createOnboarding,
  completeOnboarding,
  listOffboarding,
  createOffboarding,
  completeOffboarding
};
