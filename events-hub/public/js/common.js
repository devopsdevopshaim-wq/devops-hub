// פונקציות משותפות לכל הדפים
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// השרת: באתר ב-GitHub Pages הוא ב-Cloudflare; בהרצה מקומית (npm start) הוא באותה כתובת כמו האתר.
// כתובת אחרת אפשר לקבוע ב-?api=https://... (נשמרת בטלפון), למשל לבדיקה.
const API_CLOUD = 'https://regaim-events.devopsdevopshaim.workers.dev';
const API_BASE = (() => {
  const q = new URLSearchParams(location.search).get('api');
  try { if (q && /^https:\/\/[\w.-]+$/.test(q)) localStorage.setItem('apiBase', q); } catch { /* מצב פרטי */ }
  let saved = '';
  try { saved = localStorage.getItem('apiBase') || ''; } catch { /* מצב פרטי */ }
  if (saved) return saved;
  return /\.github\.io$/.test(location.hostname) ? API_CLOUD : '';
})();

// כתובת מלאה לתמונה/סרטון שנשמרו בשרת ("/img/...")
const asset = (u) => (/^\/img\/[a-f0-9]{24}$/.test(String(u || '')) ? API_BASE + u : String(u || ''));

const adminToken = {
  get() { try { return localStorage.getItem('adminToken') || ''; } catch { return ''; } },
  set(t) { try { if (t) localStorage.setItem('adminToken', t); else localStorage.removeItem('adminToken'); } catch { /* מצב פרטי */ } },
};

async function api(url, opts = {}) {
  const o = { ...opts, headers: { ...(opts.headers || {}) } };
  if (o.body && !(o.body instanceof FormData) && typeof o.body !== 'string') {
    o.headers['Content-Type'] = 'application/json';
    o.body = JSON.stringify(o.body);
  }
  if (url.startsWith('/api/admin') && adminToken.get()) o.headers.Authorization = `Bearer ${adminToken.get()}`;
  let res;
  try {
    res = await fetch(API_BASE + url, o);
  } catch {
    const err = new Error('אין חיבור לשרת. בודקים את האינטרנט ומנסים שוב.');
    err.status = 0;
    throw err;
  }
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error((data && data.error) || `שגיאה ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function toast(msg, ms = 2800) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

const store = {
  get(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* מצב פרטי */ }
  },
};

const fmtDate = (s) => (s ? new Date(s).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '');
const money = (n) => `₪${Number(n || 0).toLocaleString('he-IL')}`;

// אירועים ששמורים במכשיר (כדי שהאפליקציה "תישאר" אצל הלקוח אחרי האירוע)
const myEvents = {
  all: () => store.get('myEvents', []),
  save(ev) {
    const list = myEvents.all().filter((e) => e.code !== ev.code);
    list.unshift(ev);
    store.set('myEvents', list);
  },
  get: (code) => myEvents.all().find((e) => e.code === code),
};

const myOrders = {
  all: () => store.get('myOrders', []),
  add(o) { store.set('myOrders', [o, ...myOrders.all().filter((x) => x.id !== o.id)].slice(0, 50)); },
};

// PWA - התקנה למסך הבית
if ('serviceWorker' in navigator) {
  // sw.js שליד הדף: לאפליקציית הלקוח בתיקייה הראשית, ולאפליקציית הניהול בתיקיית admin/
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// הקטנת תמונה בטלפון לפני שליחה (הצד הארוך עד 2000 פיקסלים), כדי שתעלה מהר ותתאים לשרת
function shrinkImage(file, maxSide = 2000, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('התמונה לא נקראה'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('התמונה לא נפתחה. נסו תמונה אחרת (JPG או PNG)')); };
    img.src = url;
  });
}

let deferredInstall = null;
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const appName = () => (location.pathname.includes('/admin/') ? 'רגעים ניהול' : 'רגעים');
const isPhone = () => Boolean(window.FS && FS.installEnv && FS.installEnv.phone);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  $$('[data-install]').forEach((b) => b.classList.remove('hidden'));
});
window.addEventListener('appinstalled', () => { deferredInstall = null; store.set('installOffer', 'done'); $('#install-bar')?.remove(); });

// התקנה: בלחיצה אחת כשהדפדפן מאפשר (אנדרואיד), אחרת הוראות מדויקות לפי הטלפון (אייפון, סמסונג, בתוך וואטסאפ...)
function installApp() {
  if (deferredInstall) {
    deferredInstall.prompt();
    deferredInstall.userChoice.then((c) => { if (c && c.outcome === 'accepted') store.set('installOffer', 'done'); });
    deferredInstall = null;
  } else if (window.FS && FS.installHelp) {
    FS.installHelp(appName());
  } else {
    toast('בדפדפן: תפריט ← "הוספה למסך הבית"');
  }
}

// הצעת התקנה אוטומטית אחרי סריקת QR: פס התקנה בתחתית, ו-auto=true פותח מיד את חלון ההתקנה (פעם אחת)
function offerInstall({ auto = false } = {}) {
  if (isStandalone() || !isPhone()) return;
  const v = store.get('installOffer', '');
  if (v === 'done' || (typeof v === 'number' && Date.now() - v < 3 * 864e5)) return;
  if (auto) {
    store.set('installOffer', Date.now());
    $('#install-bar')?.remove();
    setTimeout(installApp, 700);
    return;
  }
  if ($('#install-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'install-bar';
  bar.className = 'install-bar';
  bar.innerHTML = '<span>📲 שמרו את האפליקציה בטלפון: התמונות וההזמנות שלכם תמיד בלחיצה</span><button class="btn sm" data-i>התקנה</button><button class="icon-btn" data-x aria-label="לא עכשיו">✕</button>';
  bar.addEventListener('click', (e) => {
    if (e.target.closest('[data-i]')) installApp();
    if (e.target.closest('[data-x]')) { store.set('installOffer', Date.now()); bar.remove(); }
  });
  const top = $('.topbar');
  if (top) top.after(bar); else document.body.prepend(bar);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-install]');
  if (b) installApp();
});

// אייקוני קו (במקום אימוג׳י בכפתורים ובסרגל)
const ICONS = {
  store: '<path d="M4 9h16l-1.2 10.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.6"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  box: '<path d="M12 3 20 7v10l-8 4-8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
  cart: '<path d="M3 4h2.2l2.2 11h10.4l2-8H6.3"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  install: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M12 7v7m-3-3 3 3 3-3"/>',
  print: '<path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="9" rx="2"/><path d="M7 14h10v6.5H7z"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.5"/>',
  truck: '<path d="M3 6.5h11v9H3zM14 10h3.5l3 3v2.5H14z"/><circle cx="7" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/>',
  alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4m0 3v.2"/>',
  users: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6M18 19a5 5 0 0 0-2.5-4.3"/>',
  coins: '<ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5M5 11.5v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z"/><path d="M9 9.5c.2 2.3 2.2 4.4 4.6 4.8l1.2-1.2 2 1-.4 1.6c-3.9.4-7.9-3.6-7.6-7.5L10.4 8l1 2z"/>',
  image2: '',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
  factory: '<path d="M3.5 20V10l5 3V10l5 3V6h3l1 14z"/><path d="M3 20h18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
};
const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
// <span data-icon="cart"></span> מתמלא אוטומטית
function fillIcons(root = document) { $$('[data-icon]', root).forEach((el) => { el.innerHTML = icon(el.dataset.icon, el.dataset.iconClass ?? 'ico'); }); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => fillIcons()); else fillIcons();
