const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  skip: (req) => req.path.startsWith('/agent') || req.path.startsWith('/health'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for login / password reset to slow brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter };
