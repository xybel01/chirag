const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list(req, res) {
  try {
    const items = await prisma.automationRule.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function create(req, res) {
  const { name, trigger, conditions, actions } = req.body;
  try {
    const item = await prisma.automationRule.create({
      data: {
        name,
        trigger,
        conditions: conditions || {},
        actions: actions || {},
      }
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, trigger, conditions, actions, isActive } = req.body;
  try {
    const item = await prisma.automationRule.update({
      where: { id: Number(id) },
      data: {
        name,
        trigger,
        conditions: conditions || undefined,
        actions: actions || undefined,
        isActive: isActive !== undefined ? !!isActive : undefined
      }
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    await prisma.automationRule.delete({ where: { id: Number(id) } });
    res.json({ success: true, message: 'Automation Rule removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { list, create, update, remove };
