const router = require('express').Router();
const { z } = require('zod');
const ah = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const c = require('../controllers/auth.controller');

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ email: z.string().email(), token: z.string().min(10), password: z.string().min(8) });
const changeSchema = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) });

router.post('/login', authLimiter, validate(loginSchema), ah(c.login));
router.post('/firebase', authLimiter, ah(c.firebaseLogin));
router.post('/forgot-password', authLimiter, validate(forgotSchema), ah(c.forgotPassword));
router.post('/reset-password', authLimiter, validate(resetSchema), ah(c.resetPassword));
router.get('/microsoft', ah(c.microsoftLogin));
router.get('/microsoft/callback', ah(c.microsoftCallback));
router.get('/me', authenticate, ah(c.me));
router.post('/change-password', authenticate, validate(changeSchema), ah(c.changePassword));

module.exports = router;
