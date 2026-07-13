const express = require('express');
const router = express.Router();
const controller = require('../controllers/agent.controller');

// Secure endpoint for client inventory upload
router.post('/submit', controller.submit);

module.exports = router;
