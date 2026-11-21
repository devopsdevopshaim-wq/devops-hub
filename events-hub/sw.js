// Service Worker של אפליקציית הלקוח: האפליקציה נפתחת מהמסך הראשי ועובדת גם עם חיבור חלש.
// כתובות יחסיות, כי האתר יושב בתת-תיקייה ב-GitHub Pages (/devops-hub/events-hub/).
// השרת (Cloudflare) בכתובת אחרת, ולכן בקשות אליו לא נשמרות במטמון.
const CACHE = 'regaim-v13';
const SHELL = ['./', 'index.html', 'event.html', 'track.html', 'css/app.css', 'css/theme.css', 'js/photos.js', 'js/common.js', 'js/app.js', 'js/event.js', 'js/editor.js', 'js/install-help.js', 'manifest.json', 'icons/icon.svg', 'icons/logo.svg'];
const BASE = new URL('./', self.location).pathname;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('regaim-v') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
  if (url.pathname.startsWith(BASE + 'admin/')) return;
  // רשת קודם, ואם אין חיבור - מהמטמון
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: url.pathname.endsWith('event.html') || url.pathname.endsWith('track.html') }).then((r) => r || caches.match('./')))
  );
});
