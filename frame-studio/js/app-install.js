/* The manager app on the phone: the same admin site, installed to the home screen (no store, no big file, updates by itself).
   Registers the offline worker (which also receives photos shared to the app), and offers the install where it is possible:
   Android/Chrome with its own install prompt, iPhone with the two taps Safari needs. On app.html it also draws the QR code
   that opens the install page on the phone. */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var ua = navigator.userAgent, ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1), android = /Android/i.test(ua), phone = ios || android || /Mobi/i.test(ua);
  var deferred = null, KEY = 'fs-app-nag';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; render(); });
  window.addEventListener('appinstalled', function () { deferred = null; ls(KEY, 'done'); var b = document.getElementById('app-bar'); if (b) b.remove(); render(); });
  function install() {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; render(); }); return; }
    if (ios) return iosHelp();
    location.href = 'app.html';
  }
  function iosHelp() {
    var d = document.createElement('div'); d.className = 'app-sheet';
    d.innerHTML = '<div class="app-sheet-in"><b>התקנה באייפון (2 לחיצות)</b><ol><li>פותחים את הדף הזה ב־<b>Safari</b>.</li><li>לוחצים על כפתור השיתוף <span class="app-ico">⬆︎</span> בתחתית המסך.</li><li>בוחרים <b>"הוסף למסך הבית"</b> ← "הוסף".</li></ol><p>האייקון "פריים ניהול" יופיע במסך הבית, ונפתח כמו אפליקציה.</p><button type="button">הבנתי</button></div>';
    d.addEventListener('click', function (e) { if (e.target === d || e.target.tagName === 'BUTTON') d.remove(); });
    document.body.appendChild(d);
  }
  /* the admin, on a phone, outside the app: a small bar once in a while */
  function bar() {
    var v = ls(KEY) || '', m = /later-(\d+)/.exec(v);
    if (standalone || !phone || document.getElementById('app-bar') || v === 'done' || (m && Date.now() - Number(m[1]) < 7 * 864e5)) return;
    var b = document.createElement('div'); b.id = 'app-bar';
    b.innerHTML = '<span>📲 ניהול העסק כאפליקציה בטלפון: פותחים מהמסך הראשי, במסך מלא</span><button type="button" data-i>התקנה</button><button type="button" data-x aria-label="לא עכשיו">✕</button>';
    b.addEventListener('click', function (e) { if (e.target.closest('[data-i]')) install(); if (e.target.closest('[data-x]')) { ls(KEY, 'later-' + Date.now()); b.remove(); } });
    document.body.appendChild(b);
  }
  /* app.html: the install page */
  function render() {
    var go = document.getElementById('app-go'); if (!go) return;
    var st = document.getElementById('app-state');
    if (standalone) { st.textContent = '✔ האפליקציה מותקנת ופתוחה עכשיו.'; go.textContent = 'כניסה לניהול ←'; go.onclick = function () { location.href = 'admin.html?app=1'; }; return; }
    if (deferred) { st.textContent = 'הטלפון מוכן להתקנה: לחיצה אחת.'; go.textContent = '📲 התקנת האפליקציה'; }
    else if (ios) { st.textContent = 'באייפון מתקינים מ־Safari, בשתי לחיצות:'; go.textContent = '📲 איך מתקינים באייפון'; }
    else if (android) { st.textContent = 'אם לא מופיע חלון התקנה: בתפריט של Chrome (⋮) ← "התקנת אפליקציה" או "הוספה למסך הבית".'; go.textContent = '📲 התקנה'; }
    else { st.textContent = 'זה מחשב. סורקים את הקוד עם מצלמת הטלפון, ומתקינים שם.'; go.textContent = 'פתיחת הניהול במחשב ←'; go.onclick = function () { location.href = 'admin.html'; }; return; }
    go.onclick = install;
  }
  function qr() {
    var box = document.getElementById('app-qr'); if (!box) return;
    var s = document.createElement('script'); s.src = 'vendor/qrcode.js';
    s.onload = function () {
      var Q = window.qrcode(0, 'M'); Q.addData(location.href.split('#')[0]); Q.make();
      var n = Q.getModuleCount(), px = 6, c = document.createElement('canvas'); c.width = c.height = (n + 8) * px;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#111';
      for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (Q.isDark(r, k)) g.fillRect((k + 4) * px, (r + 4) * px, px, px);
      c.setAttribute('aria-label', 'קוד QR לפתיחת דף ההתקנה בטלפון'); box.appendChild(c);
    };
    document.head.appendChild(s);
  }
  function start() { if (document.getElementById('app-go')) { render(); if (!phone) qr(); } else setTimeout(bar, 4000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.FS = window.FS || {}; window.FS.appInstall = install;
})();
