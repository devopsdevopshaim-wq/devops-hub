/* Second server for every n8n endpoint. The sites call https://…n8n.cloud/webhook/<name>; when portfolio/api.json (written by the Cloudflare
   deploy) names a base address, the same call goes there first, and falls back to the n8n address on a network error, a 404 or a 5xx.
   One server being down, or n8n's monthly quota running out, no longer takes these features down. (The sign-in has its own failover in auth.js.)
   Load it before any script that calls the server. */
(function () {
  'use strict';
  if (window.__spiderFailover) return;
  window.__spiderFailover = true;
  var N8N = 'https://haimkripisn.app.n8n.cloud/webhook/';
  var NAMES = { 'hasadna-lead': 1, 'hasadna-prices': 1, 'hasadna-admin': 1, 'hasadna-hubs': 1, 'comic-draw': 1, 'hasadna-voice': 1, 'hasadna-guide': 1, 'hasadna-status': 1 };
  var native = window.fetch.bind(window);
  var cs = document.currentScript;
  var cfg = cs && cs.src ? cs.src.replace(/js\/failover\.js.*$/, 'api.json') : '';
  var base = '';
  var ready = cfg ? native(cfg, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && /^https:\/\//.test(j.base || '')) base = j.base.replace(/\/+$/, ''); }).catch(function () {}) : Promise.resolve();
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : '';
    if (url.indexOf(N8N) !== 0) return native(input, init);
    var rest = url.slice(N8N.length);
    if (!NAMES[rest.split(/[?#]/)[0]]) return native(input, init);
    return ready.then(function () {
      if (!base) return native(input, init);
      return native(base + '/' + rest, init).then(function (r) {
        if (r.status === 404 || r.status >= 500) return native(input, init).then(function (r2) { return r2.ok ? r2 : r; }, function () { return r; });
        return r;
      }, function () { return native(input, init); });
    });
  };
})();
