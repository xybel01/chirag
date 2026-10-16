const express = require('express');
const router = express.Router();
const controller = require('../controllers/alerts.controller');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, controller.list);
router.post('/:id/acknowledge', requireAuth, controller.acknowledge);
router.post('/:id/resolve', requireAuth, controller.resolve);
router.post('/:id/create-ticket', requireAuth, controller.createTicketFromAlert);

module.exports = router;
