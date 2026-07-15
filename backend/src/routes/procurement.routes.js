const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const c = require('../controllers/procurement.controller');

router.use(authenticate);

// Requests
router.get('/requests', ah(c.listRequests));
router.post('/requests', ah(c.createRequest));
router.put('/requests/:id/approve', requireRole('SUPER_ADMIN', 'IT_MANAGER'), ah(c.approveRequest));

// Orders
router.get('/orders', ah(c.listOrders));
router.put('/orders/:id/receive', requireRole('SUPER_ADMIN', 'IT_MANAGER'), ah(c.receiveOrder));

module.exports = router;
