const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/approval.controller');

router.use(authenticate);
router.get('/', ah(c.list));
router.post('/', ah(c.create));
router.put('/steps/:stepId', ah(c.action));

module.exports = router;
