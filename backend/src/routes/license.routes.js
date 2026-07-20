const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const { requireRole, IT_STAFF } = require('../middleware/rbac');
const c = require('../controllers/license.controller');

router.use(authenticate);

router.get('/', ah(c.list));
router.get('/:id', ah(c.get));
router.post('/', requireRole(...IT_STAFF), ah(c.create));
router.put('/:id', requireRole(...IT_STAFF), ah(c.update));
router.delete('/:id', requireRole(...IT_STAFF), ah(c.remove));
router.post('/:id/assign', requireRole(...IT_STAFF), ah(c.assignSeat));
router.post('/:id/revoke', requireRole(...IT_STAFF), ah(c.revokeSeat));

module.exports = router;
