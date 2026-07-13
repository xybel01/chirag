const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const c = require('../controllers/audit.controller');

router.get('/', authenticate, requireRole('IT_MANAGER'), ah(c.list));

module.exports = router;
