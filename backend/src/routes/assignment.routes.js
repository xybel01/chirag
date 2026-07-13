const router = require('express').Router();
const { z } = require('zod');
const ah = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireRole, VIEWERS } = require('../middleware/rbac');
const c = require('../controllers/assignment.controller');

const actSchema = z.object({
  assetId: z.coerce.number().int(),
  userId: z.coerce.number().int().optional(),
  action: z.enum(['ASSIGN', 'RETURN', 'TRANSFER', 'REPLACE', 'REPAIR', 'DISPOSE']),
  notes: z.string().optional(),
  signature: z.string().startsWith('data:image/png;base64,').optional(),
});

router.use(authenticate);
router.get('/my-assets', ah(c.myAssets)); // any authenticated employee
router.get('/', requireRole(...VIEWERS), ah(c.list));
router.post('/', requireRole('IT_MANAGER', 'IT_SUPPORT'), validate(actSchema), ah(c.act));

module.exports = router;
