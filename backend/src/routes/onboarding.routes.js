const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/onboarding.controller');

router.use(authenticate);

// Onboarding endpoints
router.get('/onboarding', ah(c.listOnboarding));
router.post('/onboarding', ah(c.createOnboarding));
router.put('/onboarding/:id/complete', ah(c.completeOnboarding));

// Offboarding endpoints
router.get('/offboarding', ah(c.listOffboarding));
router.post('/offboarding', ah(c.createOffboarding));
router.put('/offboarding/:id/complete', ah(c.completeOffboarding));

module.exports = router;
