const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const config = require('./config');

const UPLOAD_DIR = path.join(config.dataDir, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
  'video/webm': '.webm', 'video/mp4': '.mp4',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + ALLOWED[file.mimetype]),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error('סוג קובץ לא נתמך'))),
});

// מגביל קצב פשוט בזיכרון
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip + req.baseUrl + req.path;
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    if (list.length > max) return res.status(429).json({ error: 'יותר מדי בקשות, נסו שוב בעוד מספר דקות' });
    next();
  };
}

const token = (n = 16) => crypto.randomBytes(n).toString('hex');
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const num = (v, def = 0) => (v !== '' && v !== null && Number.isFinite(Number(v)) ? Number(v) : def);
const arr = (v) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map((x) => str(x, 100)).filter(Boolean);

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = { UPLOAD_DIR, upload, rateLimit, token, str, num, arr, safeEqual };
