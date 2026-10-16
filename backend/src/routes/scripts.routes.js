const express = require('express');
const router = express.Router();
const controller = require('../controllers/scripts.controller');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);
router.post('/run', requireAuth, controller.run);

module.exports = router;
