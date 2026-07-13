const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../config/prisma');
const HttpError = require('../utils/httpError');

async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    // Query-string token is accepted so <img> tags and download links can authenticate.
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
    if (!token) throw new HttpError(401, 'Authentication required');
    const payload = jwt.verify(token, config.jwt.secret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true, departmentId: true },
    });
    if (!user || !user.isActive) throw new HttpError(401, 'Account disabled or not found');
    req.user = user;
    next();
  } catch (err) {
    next(err.status ? err : new HttpError(401, 'Invalid or expired token'));
  }
}

module.exports = { authenticate };
