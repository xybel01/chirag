const router = require('express').Router();
const { z } = require('zod');
const ah = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');
const c = require('../controllers/user.controller');

const base = {
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(ROLES),
  phone: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  departmentId: z.coerce.number().int().optional().nullable(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
};
const createSchema = z.object(base);
const updateSchema = z.object(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.optional()])));

router.use(authenticate);
router.get('/', requireRole('IT_MANAGER', 'IT_SUPPORT', 'HR'), ah(c.list));
router.get('/:id', requireRole('IT_MANAGER', 'IT_SUPPORT', 'HR'), ah(c.get));
router.post('/', requireRole('IT_MANAGER', 'HR'), validate(createSchema), ah(c.create));
router.put('/:id', requireRole('IT_MANAGER', 'HR'), validate(updateSchema), ah(c.update));
router.delete('/:id', requireRole('IT_MANAGER'), ah(c.deactivate));

module.exports = router;
