const express = require('express');
const router = express.Router();
const controller = require('../controllers/tickets.controller');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);
router.get('/:id', requireAuth, controller.getById);
router.put('/:id', requireAuth, controller.update);
router.post('/:id/comments', requireAuth, controller.addComment);
router.post('/:id/worklogs', requireAuth, controller.addWorklog);
router.post('/:id/ai-copilot', requireAuth, controller.aiCopilot);

module.exports = router;
