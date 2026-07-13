const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const msal = require('@azure/msal-node');
const prisma = require('../config/prisma');
const config = require('../config');
const HttpError = require('../utils/httpError');
const { sendMail, layout } = require('../services/email');
const { logAudit } = require('../services/audit');
const firebaseService = require('../services/firebase.service');

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, email: user.email }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, departmentId: u.departmentId });

// ---- Password login ----
async function login(req, res) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new HttpError(403, 'Account is disabled');
  await logAudit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ip: req.ip });
  res.json({ token: signToken(user), user: publicUser(user) });
}

async function me(req, res) {
  res.json({ user: req.user });
}

// ---- Forgot / reset password ----
async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: crypto.createHash('sha256').update(token).digest('hex'), resetTokenExp: new Date(Date.now() + 3600000) },
    });
    const link = `${config.appUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your IT Inventory password',
      html: layout('Password Reset', `<p>Click the link below to reset your password (valid 1 hour):</p><p><a href="${link}">${link}</a></p>`),
    });
  }
  // Always 200 to avoid revealing which emails exist.
  res.json({ message: 'If that email exists, a reset link has been sent.' });
}

async function resetPassword(req, res) {
  const { email, token, password } = req.body;
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), resetToken: hashed, resetTokenExp: { gt: new Date() } },
  });
  if (!user) throw new HttpError(400, 'Invalid or expired reset token');
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12), resetToken: null, resetTokenExp: null },
  });
  await logAudit({ userId: user.id, action: 'PASSWORD_RESET', entity: 'User', entityId: user.id, ip: req.ip });
  res.json({ message: 'Password updated. You can now sign in.' });
}

// ---- Microsoft 365 login (OAuth2 auth-code flow via MSAL) ----
let msalClient = null;
function getMsal() {
  if (!config.ms.enabled) throw new HttpError(501, 'Microsoft 365 login is not configured');
  if (!msalClient) {
    msalClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId: config.ms.clientId,
        clientSecret: config.ms.clientSecret,
        authority: `https://login.microsoftonline.com/${config.ms.tenantId}`,
      },
    });
  }
  return msalClient;
}

async function microsoftLogin(_req, res) {
  const url = await getMsal().getAuthCodeUrl({ scopes: ['user.read'], redirectUri: config.ms.redirectUri });
  res.redirect(url);
}

async function microsoftCallback(req, res) {
  const result = await getMsal().acquireTokenByCode({
    code: req.query.code,
    scopes: ['user.read'],
    redirectUri: config.ms.redirectUri,
  });
  const claims = result.account;
  const email = (claims.username || '').toLowerCase();
  if (!email) throw new HttpError(400, 'Microsoft account has no email');

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Auto-provision as EMPLOYEE; admin can elevate the role later.
    user = await prisma.user.create({
      data: { email, name: claims.name || email, role: 'EMPLOYEE', msObjectId: claims.homeAccountId },
    });
  } else if (!user.msObjectId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { msObjectId: claims.homeAccountId } });
  }
  if (!user.isActive) throw new HttpError(403, 'Account is disabled');
  await logAudit({ userId: user.id, action: 'LOGIN_M365', entity: 'User', entityId: user.id, ip: req.ip });
  // Hand the JWT to the SPA via redirect fragment.
  res.redirect(`${config.appUrl}/login#token=${signToken(user)}`);
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (user.passwordHash && !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
  res.json({ message: 'Password changed' });
}

async function firebaseLogin(req, res) {
  const { token } = req.body;
  if (!token) throw new HttpError(400, 'Firebase ID token is required');

  const decoded = await firebaseService.verifyFirebaseIdToken(token);
  const email = decoded.email.toLowerCase();

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const role = decoded.role || 'EMPLOYEE';
    user = await prisma.user.create({
      data: {
        email,
        name: decoded.name || email.split('@')[0],
        role,
        isActive: true,
      },
    });
  }

  if (!user.isActive) throw new HttpError(403, 'Account is disabled');
  await logAudit({ userId: user.id, action: 'LOGIN_FIREBASE', entity: 'User', entityId: user.id, ip: req.ip });

  res.json({ token: signToken(user), user: publicUser(user) });
}

module.exports = { login, me, forgotPassword, resetPassword, microsoftLogin, microsoftCallback, changePassword, firebaseLogin };
