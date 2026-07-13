const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const { requireRole, VIEWERS } = require('../middleware/rbac');
const c = require('../controllers/dashboard.controller');

router.get('/', authenticate, requireRole(...VIEWERS), ah(c.stats));

module.exports = router;
