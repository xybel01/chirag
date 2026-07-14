const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const c = require('../controllers/meta.controller');

router.use(authenticate);
router.get('/:type', ah(c.list));
router.post('/:type', requireRole('IT_MANAGER', 'IT_SUPPORT'), ah(c.create));
router.put('/:type/:id', requireRole('IT_MANAGER', 'IT_SUPPORT'), ah(c.update));
router.delete('/:type/:id', requireRole('IT_MANAGER', 'IT_SUPPORT'), ah(c.remove));

module.exports = router;
