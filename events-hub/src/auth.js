const crypto = require('crypto');
const config = require('./config');

const COOKIE = 'admin_session';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function sign(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('hex');
}

function createToken() {
  const payload = `admin.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const ts = Number(payload.split('.')[1]);
  return Date.now() - ts < MAX_AGE_MS;
}

function checkPassword(pw) {
  const a = crypto.createHash('sha256').update(String(pw || '')).digest();
  const b = crypto.createHash('sha256').update(config.adminPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (verifyToken(req.cookies[COOKIE])) return next();
  res.status(401).json({ error: 'נדרשת התחברות מנהל' });
}

module.exports = { COOKIE, MAX_AGE_MS, createToken, verifyToken, checkPassword, requireAdmin };
