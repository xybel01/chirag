const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/kb.controller');

router.use(authenticate);
router.get('/', ah(c.list));
router.get('/:id', ah(c.get));
router.post('/', ah(c.create));
router.post('/:id/vote', ah(c.vote));

module.exports = router;
