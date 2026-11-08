// הגדרות. בענן הן מגיעות מ-Cloudflare (משתנים וסודות שה-workflow ב-GitHub מגדיר), ובהרצה מקומית מקובץ .env.
const config = {
  // כתובת אתר האפליקציה ב-GitHub Pages (ממנה נבנים קישורי ה-QR ומעקב ההזמנה)
  pagesUrl: 'https://devopsdevopshaim-wq.github.io/devops-hub/events-hub',
  adminPassword: '',
  sessionSecret: '',
  payment: { provider: 'mock', terminal: '', apiKey: '', apiSecret: '' },
  ai: { removeBgKey: '' },
  // מגבלת קצב פעילה תמיד בענן; RATE_LIMIT=off רק לבדיקות אוטומטיות במחשב
  rateLimit: true,
};

export function configure(env = {}) {
  const v = (k) => (env[k] === undefined || env[k] === null ? '' : String(env[k]));
  if (v('PAGES_URL')) config.pagesUrl = v('PAGES_URL').replace(/\/$/, '');
  config.adminPassword = v('ADMIN_PASSWORD');
  config.sessionSecret = v('SESSION_SECRET') || (config.adminPassword ? `regaim:${config.adminPassword}:session` : '');
  config.payment = {
    provider: v('PAYMENT_PROVIDER') || 'mock',
    terminal: v('PAYMENT_TERMINAL'),
    apiKey: v('PAYMENT_API_KEY'),
    apiSecret: v('PAYMENT_API_SECRET'),
  };
  config.ai = { removeBgKey: v('REMOVE_BG_API_KEY') };
  config.rateLimit = v('RATE_LIMIT') !== 'off';
  return config;
}

export default config;
