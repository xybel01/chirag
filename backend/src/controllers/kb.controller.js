const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list(req, res) {
  const { category, search } = req.query;
  try {
    const items = await prisma.knowledgeArticle.findMany({
      where: {
        status: 'PUBLISHED',
        ...(category ? { category } : {}),
        ...(search ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } }
          ]
        } : {})
      },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function get(req, res) {
  const { id } = req.params;
  try {
    const item = await prisma.knowledgeArticle.findUnique({
      where: { id: Number(id) },
      include: { author: { select: { name: true } } }
    });
    if (!item) return res.status(404).json({ error: 'Article not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function create(req, res) {
  const { title, content, category } = req.body;
  const authorId = req.user.id;
  try {
    const item = await prisma.knowledgeArticle.create({
      data: {
        title,
        content,
        category,
        authorId,
        status: 'PUBLISHED'
      }
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function vote(req, res) {
  const { id } = req.params;
  const { vote } = req.body; // 'helpful' | 'nothelpful'
  try {
    const article = await prisma.knowledgeArticle.findUnique({ where: { id: Number(id) } });
    if (!article) return res.status(404).json({ error: 'Article not found' });

    const updated = await prisma.knowledgeArticle.update({
      where: { id: Number(id) },
      data: {
        helpful: vote === 'helpful' ? article.helpful + 1 : article.helpful,
        notHelpful: vote === 'nothelpful' ? article.notHelpful + 1 : article.notHelpful
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { list, get, create, vote };
