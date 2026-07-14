const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list(req, res) {
  try {
    const items = await prisma.sLA.findMany({ orderBy: { priority: 'asc' } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function create(req, res) {
  const { name, priority, type, responseTimeMins, resolutionTimeMins } = req.body;
  try {
    const item = await prisma.sLA.create({
      data: {
        name,
        priority,
        type,
        responseTimeMins: Number(responseTimeMins),
        resolutionTimeMins: Number(resolutionTimeMins),
      }
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, priority, type, responseTimeMins, resolutionTimeMins, isActive } = req.body;
  try {
    const item = await prisma.sLA.update({
      where: { id: Number(id) },
      data: {
        name,
        priority,
        type,
        responseTimeMins: responseTimeMins ? Number(responseTimeMins) : undefined,
        resolutionTimeMins: resolutionTimeMins ? Number(resolutionTimeMins) : undefined,
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
    await prisma.sLA.delete({ where: { id: Number(id) } });
    res.json({ success: true, message: 'SLA Policy removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { list, create, update, remove };
