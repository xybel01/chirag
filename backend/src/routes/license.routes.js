const router = require('express').Router();
const { z } = require('zod');
const ah = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireRole, VIEWERS } = require('../middleware/rbac');
const c = require('../controllers/license.controller');

const licenseSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['M365', 'ANTIVIRUS', 'RINGCENTRAL', 'DYNAMICS365', 'OTHER']),
  vendorId: z.coerce.number().int().optional().nullable(),
  licenseKey: z.string().optional().nullable(),
  totalSeats: z.coerce.number().int().positive().optional(),
  purchaseDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  costPerSeat: z.coerce.number().nonnegative().optional().nullable(),
  totalCost: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.use(authenticate);
router.get('/', requireRole(...VIEWERS), ah(c.list));
router.get('/:id', requireRole(...VIEWERS), ah(c.get));
router.post('/', requireRole('IT_MANAGER', 'IT_SUPPORT'), validate(licenseSchema), ah(c.create));
router.put('/:id', requireRole('IT_MANAGER', 'IT_SUPPORT'), validate(licenseSchema.partial()), ah(c.update));
router.post('/:id/assign', requireRole('IT_MANAGER', 'IT_SUPPORT'), validate(z.object({ userId: z.coerce.number().int() })), ah(c.assignSeat));
router.delete('/assignments/:assignmentId', requireRole('IT_MANAGER', 'IT_SUPPORT'), ah(c.revokeSeat));

module.exports = router;
