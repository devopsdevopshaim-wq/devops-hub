/* live.html as the guests' app: the QR on the table opens the page, and the page offers to install itself on the phone.
   - The event (e + k from the QR) is remembered on the phone ('fs-live-events'), so the app opened from the home screen
     (guest.webmanifest: start_url live.html?app=1, no keys) goes straight back to the last event.
   - Install: Chrome / Edge on Android give 'beforeinstallprompt', so the bar's button installs in one tap; everywhere else
     (iPhone, Samsung, inside WhatsApp…) FS.installHelp (install-help.js) shows the exact steps. The bar shows on phones,
     outside the installed app, a few seconds after the page opens; after the first photo is sent the steps open by
     themselves once ('fs-live-app' = done / later-<time>).
   - guest-app.json { storeUrl }: when set, a "🛍️" button to the gifts store (the Regaim app, events-hub) on the bar and
     after sending. Empty = no button.
   window.FLApp: remember(title), last(), afterSend(), storeHtml(). */
(function () {
  'use strict';
  var KEY = 'fs-live-events', NAG = 'fs-live-app';
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var env = (window.FS && FS.installEnv) || {};
  var deferred = null, store = '';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function list() { try { return JSON.parse(ls(KEY) || '[]') || []; } catch (e) { return []; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var q = new URLSearchParams(location.search), e = (q.get('e') || '').replace(/[^a-z0-9]/g, ''), k = (q.get('k') || '').replace(/[^a-f0-9]/g, '');
  function remember(title) {
    if (!e || !k) return;
    var all = list().filter(function (x) { return x.e !== e; });
    var old = list().filter(function (x) { return x.e === e; })[0] || {};
    all.unshift({ e: e, k: k, t: title || old.t || '', at: Date.now() });
    ls(KEY, JSON.stringify(all.slice(0, 20)));
  }
  remember('');

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
  window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); deferred = ev; });
  window.addEventListener('appinstalled', function () { if (window.FS && FS.trackInstall) FS.trackInstall('live'); deferred = null; ls(NAG, 'done'); var b = document.getElementById('lv-app'); if (b) b.remove(); });

  function install() {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function (c) { deferred = null; if (c && c.outcome === 'accepted') ls(NAG, 'done'); }); return; }
    if (FS.installHelp) FS.installHelp('התמונות שלי מהאירוע');
  }
  function snoozed() { var v = ls(NAG) || '', m = /later-(\d+)/.exec(v); return v === 'done' || (m && Date.now() - Number(m[1]) < 3 * 864e5); }

  function css() {
    if (document.getElementById('lv-app-css')) return;
    var s = document.createElement('style'); s.id = 'lv-app-css';
    s.textContent = '#lv-app{position:fixed;inset-inline:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:2147483000;display:flex;gap:8px;align-items:center;' +
      'background:#1d1633;color:#fff;border:1px solid #D6B77E;border-radius:16px;padding:10px 12px;box-shadow:0 18px 40px -16px #000;font:600 15px Heebo,Assistant,sans-serif;direction:rtl}' +
      '#lv-app span{flex:1;line-height:1.35}#lv-app button,#lv-app a{border:0;border-radius:12px;min-height:42px;padding:0 14px;font:700 15px Heebo,sans-serif;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}' +
      '#lv-app [data-i]{background:linear-gradient(115deg,#A9864C,#F3DDA6,#C9A35F);color:#0D0B10}#lv-app a{background:#2b2540;color:#fff}#lv-app [data-x]{background:none;color:#cfc8de;padding:0 6px;min-height:42px}' +
      '.lv-store{display:flex;justify-content:center;margin-top:12px}.lv-store a{text-decoration:none}';
    document.head.appendChild(s);
  }
  function bar() {
    if (standalone || !env.phone || snoozed() || document.getElementById('lv-app')) return;
    css();
    var b = document.createElement('div'); b.id = 'lv-app'; b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'התקנת האפליקציה');
    b.innerHTML = '<span>📲 שמרו את האפליקציה בטלפון: התמונות שלכם מהאירוע, תמיד בלחיצה</span><button type="button" data-i>התקנה</button>' +
      (store ? '<a href="' + esc(store) + '" target="_blank" rel="noopener" aria-label="חנות המתנות">🛍️</a>' : '') +
      '<button type="button" data-x aria-label="לא עכשיו">✕</button>';
    b.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-i]')) install();
      if (ev.target.closest('[data-x]')) { ls(NAG, 'later-' + Date.now()); b.remove(); }
    });
    document.body.appendChild(b);
  }

  fetch('guest-app.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    .then(function (j) { var u = String((j && j.storeUrl) || ''); store = /^https:\/\//.test(u) ? u : ''; })
    .then(function () { setTimeout(bar, 2500); });

  window.FLApp = {
    remember: remember,
    /* the last event saved on this phone, for the app opened from the home screen */
    last: function () { return list()[0] || null; },
    /* after a photo went out: the install steps open once by themselves (on phones, outside the app) */
    afterSend: function () {
      if (standalone || !env.phone || snoozed()) return;
      ls(NAG, 'later-' + Date.now());
      var b = document.getElementById('lv-app'); if (b) b.remove();
      setTimeout(install, 900);
    },
    storeHtml: function () { return store ? '<p class="lv-store"><a class="lv-send alt" href="' + esc(store) + '" target="_blank" rel="noopener">🛍️ מגנטים, מתנות וחבילות לאירועים</a></p>' : ''; }
  };
})();
