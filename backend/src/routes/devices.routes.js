const express = require('express');
const router = express.Router();
const controller = require('../controllers/devices.controller');
const { requireAuth } = require('../middleware/auth');

// Allow viewing devices with authentication
router.get('/', requireAuth, controller.list);
router.get('/:id', requireAuth, controller.getById);

// Remote Actions (Terminal Command, Script, Kill Process, Service Control, Reboot)
router.post('/:serialNumber/command', requireAuth, controller.executeCommand);
router.post('/:serialNumber/script', requireAuth, controller.executeScript);
router.post('/:serialNumber/kill-process', requireAuth, controller.killProcess);
router.post('/:serialNumber/service-action', requireAuth, controller.serviceAction);
router.post('/:serialNumber/reboot', requireAuth, controller.rebootDevice);

// Poll Task Result
router.get('/tasks/:taskId', requireAuth, controller.getTaskStatus);

module.exports = router;
