const router = require('express').Router();
const { z } = require('zod');
const ah = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireRole, VIEWERS } = require('../middleware/rbac');
const c = require('../controllers/repair.controller');

const createSchema = z.object({
  assetId: z.coerce.number().int(),
  issue: z.string().min(1),
  vendorId: z.coerce.number().int().optional().nullable(),
  isWarrantyClaim: z.coerce.boolean().optional(),
  diagnosis: z.string().optional().nullable(),
});
const updateSchema = z.object({
  vendorId: z.coerce.number().int().optional().nullable(),
  issue: z.string().optional(),
  diagnosis: z.string().optional().nullable(),
  partsReplaced: z.string().optional().nullable(),
  isWarrantyClaim: z.coerce.boolean().optional(),
  cost: z.coerce.number().nonnegative().optional(),
  status: z.enum(['OPEN', 'SENT_TO_VENDOR', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

router.use(authenticate);
router.get('/', requireRole(...VIEWERS), ah(c.list));
router.get('/:id', requireRole(...VIEWERS), ah(c.get));
router.post('/', requireRole('IT_MANAGER', 'IT_SUPPORT'), validate(createSchema), ah(c.create));
router.put('/:id', requireRole('IT_MANAGER', 'IT_SUPPORT'), validate(updateSchema), ah(c.update));

module.exports = router;
