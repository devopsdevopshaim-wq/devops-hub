/* פריים־סטודיו offline shell: the page and its files come from the network first, the cache when offline. */
var CACHE = 'frame-studio-v42';
/* the AI models and libraries are big and never change: kept in their own cache, served from it first, so the AI works offline */
var HEAVY = 'frame-studio-ai-v1';
var FILES = ['./', 'index.html', 'show.html', 'css/show.css', 'js/show.js', 'vendor/gsap/gsap.min.js', 'vendor/gsap/ScrollTrigger.min.js', 'studio.html', 'business.json', 'css/studio.css', 'css/site.css', 'js/core.js', 'js/frames.js', 'js/events.js', 'js/site.js', 'js/ui.js', 'js/ai.js', 'js/output.js', 'js/games.js', 'js/event-studio.js', 'js/styles.js', 'js/ai-studio.js', 'js/grid.js', 'js/printlog.js', 'js/shell.js', 'js/inv-frame.js', 'vendor/qrcode.js', 'js/invite.js', 'design.html', 'js/design.js', 'css/design.css', 'admin.html', 'js/admin.js', 'js/admin-biz.js', 'js/account.js', 'js/gate.js', 'css/gate.css', 'css/lux-studio.css', 'css/tools-x.css', 'css/lux-admin.css', 'js/collage.js', 'js/curate.js', 'js/admin-views.js', 'css/lux-site.css', 'js/lux.js', 'css/admin.css', 'frames/frames.json', 'js/library.js', 'js/intro.js', 'js/business.js', 'js/deals.js', 'pay.html', 'js/pay.js', 'css/pay.css', 'js/grow.js', 'js/chat.js', 'gallery.html', 'js/gallery.js', 'css/gallery.css', 'accessibility.html', 'download.html', 'css/download.css', 'agreement.html', 'js/download.js', 'js/admin-licenses.js', 'js/local-ai.js', 'css/local-ai.css', 'js/pro.js', 'js/landing.js', 'css/intro.css', 'icon.svg', 'manifest.webmanifest', 'js/live.js', 'css/live-studio.css', 'live.html', 'js/live-common.js', 'js/live-guest.js', 'css/live.css', 'wall.html', 'js/wall.js', 'css/wall.css', 'album.html', 'js/album.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE && k !== HEAVY; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (/\/version\.json$/.test(u.pathname)) return;   /* the version check always goes to the server */
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.indexOf('/frame-studio/') < 0) return;
  if (u.pathname.indexOf('/library/') > -1 || u.pathname.indexOf('/media/') > -1) return;   /* videos stream with range requests */
  if (/\/frame-studio\/(models|vendor)\//.test(u.pathname)) {
    e.respondWith(caches.open(HEAVY).then(function (k) { return k.match(e.request).then(function (hit) { return hit || fetch(e.request).then(function (r) { if (r.ok) k.put(e.request, r.clone()); return r; }); }); }));
    return;
  }
  /* always ask the server whether a file changed (a cheap 304 when not), so a new page never runs with old scripts */
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(function (r) { var c = r.clone(); if (r.ok) caches.open(CACHE).then(function (k) { k.put(e.request, c); }); return r; }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
