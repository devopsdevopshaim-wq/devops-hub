// פונקציות משותפות לכל הדפים
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(url, opts = {}) {
  const o = { ...opts, headers: { ...(opts.headers || {}) } };
  if (o.body && !(o.body instanceof FormData) && typeof o.body !== 'string') {
    o.headers['Content-Type'] = 'application/json';
    o.body = JSON.stringify(o.body);
  }
  const res = await fetch(url, o);
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
  window.addEventListener('load', () => navigator.serviceWorker.register(location.pathname.startsWith('/admin') ? '/admin/sw.js' : '/sw.js').catch(() => {}));
}
let deferredInstall = null;
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const appName = () => (location.pathname.startsWith('/admin') ? 'רגעים ניהול' : 'רגעים');
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
