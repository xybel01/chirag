const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const { requireRole, VIEWERS } = require('../middleware/rbac');
const c = require('../controllers/dashboard.controller');

router.get('/', authenticate, requireRole(...VIEWERS), ah(c.stats));
router.post('/send-ack-email', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'IT_MANAGER', 'IT_SUPPORT'), ah(c.sendAckEmail));

module.exports = router;
