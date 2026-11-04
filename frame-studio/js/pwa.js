/* אופטימוס as an app on the phone (and the computer): installed from the browser to the home screen, no store, updates by
   itself (sw.js, registered in studio.html, keeps it working offline).
   - Android / Chrome / Edge: the browser's own install prompt, behind a "📲 התקנה" button in the top bar.
   - iPhone / iPad (Safari has no prompt): the same button opens the two steps (Share ⬆, then "Add to Home Screen").
   - Already installed (standalone), or inside the desktop program: no button. */
(function () {
  'use strict';
  var FS = window.FS || {};
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
  function guide() {
    var html = '<div style="line-height:1.7;font-size:16px">' +
      '<p>באייפון ובאייפד ההתקנה נעשית מ־Safari, בשני צעדים:</p>' +
      '<ol style="padding-inline-start:22px;margin:8px 0">' +
      '<li>לוחצים על כפתור השיתוף <b style="font-size:20px">⬆︎</b> בתחתית המסך (או למעלה באייפד).</li>' +
      '<li>בוחרים <b>"הוספה למסך הבית"</b>, ואז <b>"הוסף"</b>.</li></ol>' +
      '<p>האייקון של אופטימוס יופיע במסך הבית, ונפתח כמו אפליקציה, על כל המסך. אם פתחתם את הדף מתוך וואטסאפ או מאפליקציה אחרת, קודם פותחים אותו ב־Safari.</p></div>';
    if (FS.dialog) FS.dialog('📲 התקנה באייפון', html); else alert('Safari: שיתוף ← הוספה למסך הבית');
  }
  function install() {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function (c) { if (c && c.outcome === 'accepted') { var b = document.getElementById('mt-install'); if (b) b.remove(); } deferred = null; }); return; }
    if (ios) return guide();
    if (FS.dialog) FS.dialog('📲 התקנה', '<p style="line-height:1.7">בתפריט הדפדפן (⋮) בוחרים <b>"התקנת אפליקציה"</b> או <b>"הוספה למסך הבית"</b>.</p>');
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; button(); });
  window.addEventListener('appinstalled', function () { var b = document.getElementById('mt-install'); if (b) b.remove(); if (FS.toast) FS.toast('📲 אופטימוס הותקן. אפשר לפתוח אותו ממסך הבית.'); });
  /* on an iPhone the button is there from the start (Safari never sends the prompt) */
  function ready() { if (ios) button(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(ready, 600); }); else setTimeout(ready, 600);
})();
