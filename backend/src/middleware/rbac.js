const HttpError = require('../utils/httpError');

// Central role-permission map. Extend as modules grow.
const ROLES = [
  'SUPER_ADMIN',
  'IT_MANAGER',
  'IT_SUPPORT',
  'DEPARTMENT_MANAGER',
  'HR',
  'ACCOUNTS',
  'APPROVER',
  'EMPLOYEE',
  'AUDITOR'
];

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Authentication required'));
  if (req.user.role === 'SUPER_ADMIN' || roles.includes(req.user.role)) return next();
  return next(new HttpError(403, 'Insufficient permissions'));
};

// Convenience groups
const IT_STAFF = ['SUPER_ADMIN', 'IT_MANAGER', 'IT_SUPPORT'];
const VIEWERS = ['SUPER_ADMIN', 'IT_MANAGER', 'IT_SUPPORT', 'HR', 'ACCOUNTS'];

module.exports = { requireRole, IT_STAFF, VIEWERS, ROLES };
