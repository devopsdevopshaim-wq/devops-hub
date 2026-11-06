// Service Worker - מאפשר לאפליקציה להיפתח מהמסך הראשי ולעבוד גם עם חיבור חלש
const CACHE = 'regaim-v1';
const SHELL = ['/', '/index.html', '/event.html', '/track.html', '/css/app.css', '/js/common.js', '/js/app.js', '/js/event.js', '/js/editor.js', '/manifest.json', '/icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/pay/') || url.pathname.startsWith('/admin')) return;
  // רשת קודם, ואם אין חיבור - מהמטמון
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && !url.pathname.startsWith('/uploads/')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || (url.pathname.startsWith('/e/') ? caches.match('/event.html') : caches.match('/'))))
  );
});
