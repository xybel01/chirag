const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/ai.controller');

router.post('/chat', authenticate, ah(c.chat));

module.exports = router;
