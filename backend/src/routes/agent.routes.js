const express = require('express');
const router = express.Router();
const controller = require('../controllers/agent.controller');

// Secure endpoint for client inventory upload & live telemetry
router.post('/submit', controller.submit);

// Endpoint for agent to poll pending commands/scripts
router.get('/tasks', controller.pollTasks);

// Endpoint for agent to submit execution results
router.post('/tasks/:taskId/result', controller.submitTaskResult);

// One-liner PowerShell installer script
router.get('/install.ps1', controller.getInstallScript);

// Direct agent file downloads
router.get('/download/:type', controller.downloadAgent);

module.exports = router;
