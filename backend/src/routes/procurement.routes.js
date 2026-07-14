const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/procurement.controller');

router.use(authenticate);

// Requests
router.get('/requests', ah(c.listRequests));
router.post('/requests', ah(c.createRequest));
router.put('/requests/:id/approve', ah(c.approveRequest));

// Orders
router.get('/orders', ah(c.listOrders));
router.put('/orders/:id/receive', ah(c.receiveOrder));

module.exports = router;
