const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const { requireRole, IT_STAFF } = require('../middleware/rbac');
const c = require('../controllers/meta.controller');

router.use(authenticate);
router.get('/:type', ah(c.list));
router.post('/:type', requireRole(...IT_STAFF), ah(c.create));
router.put('/:type/:id', requireRole(...IT_STAFF), ah(c.update));
router.delete('/:type/:id', requireRole(...IT_STAFF), ah(c.remove));

module.exports = router;
