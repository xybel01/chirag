const router = require('express').Router();
const { z } = require('zod');
const ah = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireRole, VIEWERS } = require('../middleware/rbac');
const c = require('../controllers/stock.controller');

const itemSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['ACCESSORY', 'CONSUMABLE']),
  quantity: z.coerce.number().int().nonnegative().optional(),
  minQuantity: z.coerce.number().int().nonnegative().optional(),
  unitPrice: z.coerce.number().nonnegative().optional().nullable(),
  locationId: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});
const adjustSchema = z.object({ delta: z.coerce.number().int(), reason: z.string().optional() });

router.use(authenticate);
router.get('/summary', requireRole(...VIEWERS), ah(c.summary));
router.get('/items', requireRole(...VIEWERS), ah(c.listItems));
router.post('/items', requireRole('IT_MANAGER', 'IT_SUPPORT'), validate(itemSchema), ah(c.createItem));
router.put('/items/:id', requireRole('IT_MANAGER', 'IT_SUPPORT'), validate(itemSchema.partial()), ah(c.updateItem));
router.post('/items/:id/adjust', requireRole('IT_MANAGER', 'IT_SUPPORT'), validate(adjustSchema), ah(c.adjust));

module.exports = router;
