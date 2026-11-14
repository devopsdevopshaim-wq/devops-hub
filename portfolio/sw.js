// Lets browsers install the site as an app. Everything still comes from the
// network; the only thing kept offline is a small "you're offline" page.
const OFFLINE = '<!doctype html><meta charset="utf-8"><title>SPIDER</title><body style="margin:0;display:grid;place-items:center;height:100vh;background:#0f0d24;color:#f1eefc;font:18px system-ui;direction:rtl"><p>אין חיבור לאינטרנט כרגע. SPIDER תחזור ברגע שהחיבור יחזור.</p>';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
