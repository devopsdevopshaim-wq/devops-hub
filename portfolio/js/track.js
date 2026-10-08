/* Usage statistics, first party. Sends one small note per page view (and one per opened app) to the admin's n8n flow.
   Only counters are kept there: a random visitor id from this browser, the page name, the browser family. No address,
   no cookie, no third party. Skipped when the browser says Do-Not-Track. The admin's own visits are not counted. */
(function () {
  'use strict';
  var API = 'https://haimkripisn.app.n8n.cloud/webhook/hasadna-auth';
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
  function send(ev, extra) {
    try {
      var b = new URLSearchParams(extra || {});
      b.set('action', 'track'); b.set('ev', ev); b.set('vid', vid());
      var t = get('hasadna-session'); if (t) b.set('token', t);
      fetch(API, { method: 'POST', body: b, keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  var page = location.pathname.replace(/^\/devops-hub\//, '/').replace(/\/index\.html$/, '/') || '/';
  var sent = false;
  function view() { if (sent) return; sent = true; send('view', { page: page, ref: document.referrer || '' }); }
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
