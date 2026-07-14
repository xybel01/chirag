const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/security.controller');

router.use(authenticate);
router.get('/status', ah(c.getStatus));

module.exports = router;
