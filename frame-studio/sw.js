/* פריים־סטודיו offline shell: the page and its files come from the network first, the cache when offline. */
var CACHE = 'frame-studio-v4';
var FILES = ['./', 'index.html', 'studio.html', 'business.json', 'css/studio.css', 'css/site.css', 'js/core.js', 'js/frames.js', 'js/events.js', 'js/site.js', 'js/ui.js', 'js/ai.js', 'js/output.js', 'js/games.js', 'js/event-studio.js', 'js/styles.js', 'js/library.js', 'js/intro.js', 'js/fridge3d.js', 'css/intro.css', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.indexOf('/frame-studio/') < 0) return;
  if (u.pathname.indexOf('/library/') > -1) return;
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (k) { k.put(e.request, c); }); return r; }).catch(function () { return caches.match(e.request); }));
});
