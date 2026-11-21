/* Usage statistics, first party. Sends one small note per page view (and one per opened app) to the admin's n8n flow.
   Only counters are kept there: a random visitor id from this browser, the page name, the browser family. No address,
   no cookie, no third party. Skipped when the browser says Do-Not-Track. The admin's own visits are not counted. */
(function () {
  'use strict';
  var API = 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-auth';
  var cs = document.currentScript;   // api.json sits next to the portfolio pages: ../api.json from js/track.js
  var cfg = cs && cs.src ? cs.src.replace(/js\/track\.js.*$/, 'api.json') : '';
  var ready = cfg ? fetch(cfg).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && /^https:\/\//.test(j.auth || '')) API = j.auth; }).catch(function () {}) : Promise.resolve();
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function vid() {
    var v = get('spider-vid');
    if (!/^[a-zA-Z0-9]{8,40}$/.test(v)) {
      v = '';
      var a = new Uint8Array(12);
      (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
      a.forEach(function (n) { v += (n % 36).toString(36); });
      try { localStorage.setItem('spider-vid', v); } catch (e) {}
    }
    return v;
  }
  // notes are collected and sent in one call when the visitor leaves the page (each call is one n8n execution)
  var queue = [], flushed = false;
  function flush() {
    if (!queue.length) return;
    try {
      var b = new URLSearchParams();
      b.set('action', 'track'); b.set('vid', vid()); b.set('events', JSON.stringify(queue.splice(0, 20)));
      var t = get('hasadna-session'); if (t) b.set('token', t);
      ready.then(function () { return fetch(API, { method: 'POST', body: b, keepalive: true }); }).catch(function () {});
    } catch (e) {}
  }
  function send(ev, extra) { var o = { ev: ev }; for (var k in (extra || {})) o[k] = extra[k]; queue.push(o); if (queue.length >= 20) flush(); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('pagehide', flush);
  var page = location.pathname.replace(/^\/devops-hub\//, '/').replace(/\/index\.html$/, '/') || '/';
  var sent = false;
  // one view per page per browser session (each note is one n8n execution)
  function view() {
    if (sent) return; sent = true;
    try { if (sessionStorage.getItem('spider-v:' + page)) return; sessionStorage.setItem('spider-v:' + page, '1'); } catch (e) {}
    send('view', { page: page, ref: document.referrer || '' });
  }
  if (document.visibilityState === 'prerender') document.addEventListener('visibilitychange', view); else view();
  // "open": a link or button that leaves for another site/app, or any element marked data-track="name"
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track],a[href]');
    if (!el) return;
    var name = el.getAttribute('data-track');
    if (!name) {
      var h = el.getAttribute('href') || '';
      if (!/^https?:|\.\.\//.test(h) || el.closest('nav,.admin-menu')) return;
      try { var u = new URL(h, location.href); name = u.hostname === location.hostname ? u.pathname.replace(/^\/devops-hub\//, '').replace(/\/(index\.html)?$/, '') : u.hostname; } catch (x) { return; }
    }
    if (name) send('open', { app: name, page: page });
  }, true);
  window.SpiderTrack = { open: function (n) { send('open', { app: n, page: page }); } };
})();
