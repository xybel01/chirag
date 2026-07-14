const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/ticket.controller');

router.use(authenticate);

router.get('/', ah(c.list));
router.get('/:id', ah(c.get));
router.post('/', ah(c.create));
router.put('/:id', ah(c.update));
router.post('/:id/comments', ah(c.addComment));
router.post('/:id/worklogs', ah(c.logWork));
router.post('/:id/watchers', ah(c.addWatcher));
router.delete('/:id/watchers/:userId', ah(c.removeWatcher));
router.post('/:id/survey', ah(c.submitSurvey));

module.exports = router;
