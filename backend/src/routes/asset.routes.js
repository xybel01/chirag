const router = require('express').Router();
const { z } = require('zod');
const ah = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireRole, VIEWERS } = require('../middleware/rbac');
const { upload, uploadFirebaseDocs } = require('../middleware/upload');
const c = require('../controllers/asset.controller');

const docs = [
  upload.fields([{ name: 'invoice', maxCount: 1 }, { name: 'warrantyDoc', maxCount: 1 }]),
  ah(uploadFirebaseDocs)
];

const assetSchema = z.object({
  serialNumber: z.string().min(1),
  model: z.string().min(1),
  manufacturer: z.string().min(1),
  categoryId: z.coerce.number().int(),
  vendorId: z.coerce.number().int().optional().nullable().or(z.literal('')),
  purchaseDate: z.string().optional().nullable().or(z.literal('')),
  purchasePrice: z.coerce.number().nonnegative().optional().nullable().or(z.literal('')),
  warrantyStart: z.string().optional().nullable().or(z.literal('')),
  warrantyEnd: z.string().optional().nullable().or(z.literal('')),
  locationId: z.coerce.number().int().optional().nullable().or(z.literal('')),
  departmentId: z.coerce.number().int().optional().nullable().or(z.literal('')),
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'REPAIR', 'FAULTY', 'LOST', 'DISPOSED']).optional().nullable(),
  notes: z.string().optional().nullable(),
  ram: z.string().optional().nullable().or(z.literal('')),
  storage: z.string().optional().nullable().or(z.literal('')),
  cpu: z.string().optional().nullable().or(z.literal('')),
}).passthrough();

router.use(authenticate);
router.get('/', requireRole(...VIEWERS), ah(c.list));
router.get('/:id', requireRole(...VIEWERS), ah(c.get));
router.get('/:id/qrcode', requireRole(...VIEWERS), ah(c.qrcode));
router.get('/:id/barcode', requireRole(...VIEWERS), ah(c.barcode));
router.post('/', requireRole('IT_MANAGER', 'IT_SUPPORT'), docs, validate(assetSchema), ah(c.create));
router.put('/:id', requireRole('IT_MANAGER', 'IT_SUPPORT'), docs, validate(assetSchema.partial()), ah(c.update));
router.delete('/:id', requireRole('IT_MANAGER', 'IT_SUPPORT'), ah(c.remove));

module.exports = router;
