// Service Worker של אפליקציית הניהול - מאפשר התקנה כאפליקציה נפרדת.
// נתוני ניהול תמיד נטענים מהשרת (ללא מטמון) כדי להציג מידע עדכני.
const CACHE = 'regaim-admin-v2';
const SHELL = ['/admin/', '/css/app.css', '/js/common.js', '/js/admin.js', '/js/install-help.js', '/admin/manifest.json', '/admin/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('regaim-admin') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match('/admin/')));
});
