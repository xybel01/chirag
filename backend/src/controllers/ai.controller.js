const aiService = require('../services/ai.service');

exports.chat = async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const result = await aiService.chatWithAgent(messages);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};
