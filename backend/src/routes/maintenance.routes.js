const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/maintenance.controller');

router.use(authenticate);
router.get('/', ah(c.list));
router.post('/', ah(c.create));
router.delete('/:id', ah(c.remove));

module.exports = router;
