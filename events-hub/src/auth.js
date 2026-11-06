// כניסת מנהל: אסימון חתום (HMAC) שנשמר בטלפון ונשלח בכותרת Authorization.
// (עוגיות לא עובדות טוב בין github.io לשרת ב-Cloudflare, ולכן אסימון.)
import crypto from 'node:crypto';
import config from './config.js';

export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 יום - אפליקציית ניהול בטלפון

function sign(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('hex');
}

export function createToken() {
  const payload = `admin.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!token || !config.sessionSecret) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const ts = Number(payload.split('.')[1]);
  return Date.now() - ts < MAX_AGE_MS;
}

export function checkPassword(pw) {
  if (!config.adminPassword) return false;
  const a = crypto.createHash('sha256').update(String(pw || '')).digest();
  const b = crypto.createHash('sha256').update(config.adminPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

export function bearer(req) {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
