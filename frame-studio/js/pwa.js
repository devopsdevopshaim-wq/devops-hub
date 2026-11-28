/* אופטימוס as an app on the phone (and the computer): installed from the browser to the home screen, no store, updates by
   itself (sw.js, registered in studio.html, keeps it working offline).
   - Android / Chrome / Edge: the browser's own install prompt, behind a "📲 התקנה" button in the top bar.
   - Everywhere else on a phone (iPhone, Android without the prompt, inside WhatsApp): the button opens the steps for that
     phone (js/install-help.js).
   - Already installed (standalone), or inside the desktop program: no button. */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {};
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone || window.FSDesktop) { document.documentElement.classList.add('is-app'); return; }
  var ua = navigator.userAgent || '', ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var deferred = null;
  function button() {
    var host = document.querySelector('#mt .mt-acts'); if (!host) return null;
    var b = document.getElementById('mt-install');
    if (!b) { b = document.createElement('button'); b.id = 'mt-install'; b.className = 'mt-btn'; b.type = 'button'; b.textContent = '📲 התקנה'; b.title = 'התקנת אופטימוס כאפליקציה בטלפון או במחשב'; host.insertBefore(b, host.firstChild); b.addEventListener('click', install); }
    return b;
  }
  function install() {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function (c) { if (c && c.outcome === 'accepted') { var b = document.getElementById('mt-install'); if (b) b.remove(); } deferred = null; }); return; }
    if (FS.installHelp) return FS.installHelp('אופטימוס');
    if (FS.dialog) FS.dialog('📲 התקנה', '<p style="line-height:1.7">אייפון: Safari ← שיתוף ⬆︎ ← "הוספה למסך הבית". אנדרואיד: Chrome ← ⋮ ← "התקנת אפליקציה".</p>');
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; button(); });
  window.addEventListener('appinstalled', function () { if (window.FS && FS.trackInstall) FS.trackInstall('studio'); var b = document.getElementById('mt-install'); if (b) b.remove(); if (FS.toast) FS.toast('📲 אופטימוס הותקן. אפשר לפתוח אותו ממסך הבית.'); });
  /* on every phone the button is there from the start: Safari never sends the prompt, and Android may not (yet) */
  function ready() {
    if (!(ios || (FS.installEnv && FS.installEnv.phone))) return;
    button();
    /* the start screen is the first thing a phone sees: the same install there, as one more card */
    var d = document.getElementById('ia-designs');
    if (d && !document.getElementById('ia-install')) {
      var c = document.createElement('button'); c.className = 'ia'; c.id = 'ia-install'; c.type = 'button';
      c.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 7v7m-3-3 3 3 3-3"/></svg><b>התקנה כאפליקציה</b><small>אייקון במסך הבית</small>';
      c.addEventListener('click', install); d.parentNode.appendChild(c);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(ready, 600); }); else setTimeout(ready, 600);
})();
