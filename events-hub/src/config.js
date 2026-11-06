const fs = require('fs');
const path = require('path');

// טעינת .env פשוטה (ללא תלות חיצונית)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const config = {
  port: Number(process.env.PORT || 3000),
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, ''),
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    terminal: process.env.PAYMENT_TERMINAL || '',
    apiKey: process.env.PAYMENT_API_KEY || '',
    apiSecret: process.env.PAYMENT_API_SECRET || '',
  },
  ai: {
    removeBgKey: process.env.REMOVE_BG_API_KEY || '',
  },
};

if (!process.env.ADMIN_PASSWORD) {
  console.warn('[אזהרה] ADMIN_PASSWORD לא הוגדר - משתמש בסיסמת ברירת מחדל admin123. שנה לפני עלייה לאוויר!');
}

module.exports = config;
