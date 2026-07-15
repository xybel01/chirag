const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const c = require('../controllers/license.controller');

router.use(authenticate);

router.get('/', ah(c.list));
router.get('/:id', ah(c.get));
router.post('/', requireRole('SUPER_ADMIN', 'IT_MANAGER'), ah(c.create));
router.put('/:id', requireRole('SUPER_ADMIN', 'IT_MANAGER'), ah(c.update));
router.delete('/:id', requireRole('SUPER_ADMIN', 'IT_MANAGER'), ah(c.remove));
router.post('/:id/assign', requireRole('SUPER_ADMIN', 'IT_MANAGER'), ah(c.assignSeat));
router.post('/:id/revoke', requireRole('SUPER_ADMIN', 'IT_MANAGER'), ah(c.revokeSeat));

module.exports = router;
