const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  skip: (req) => req.path.startsWith('/agent') || req.path.startsWith('/health') || req.path.startsWith('/auth'),
  validate: { trustProxy: false },
  standardHeaders: true,
  legacyHeaders: false,
});

// Generous limiter for auth to prevent lockouts behind proxies/tunnels
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  validate: { trustProxy: false },
  message: { error: 'Too many attempts, please try again in a few moments.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter };
