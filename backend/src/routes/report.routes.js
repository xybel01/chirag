const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const { requireRole, VIEWERS } = require('../middleware/rbac');
const c = require('../controllers/report.controller');

router.use(authenticate, requireRole(...VIEWERS));
router.get('/assets', ah(c.assets));            // also covers user-wise (?userId=) & department-wise (?departmentId=)
router.get('/warranty-expiry', ah(c.warrantyExpiry));
router.get('/license-expiry', ah(c.licenseExpiry));
router.get('/repairs', ah(c.repairs));
router.get('/purchases', ah(c.purchases));

module.exports = router;
