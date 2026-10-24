/* The editing workspace kept clear: no top row. Undo / redo, the page size, print and save move into the bar above the
   picture, and the business buttons (details, packages, deals, site admin, install) sit behind one ☰ menu.
   The event, text & stickers and games tabs are gone from the rail. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$;
  document.body.classList.add('clean-shell');

  /* the tools that matter while editing, in the stage bar */
  var bar = $('.stagebar'), info = $('#stage-info');
  var quick = document.createElement('div'); quick.className = 'sb-quick';
  ['#undo', '#redo'].forEach(function (s) { var el = $(s); if (el) { el.classList.remove('ic'); el.classList.add('btn', 'small', 'hist'); quick.appendChild(el); } });
  var reset = document.createElement('button'); reset.className = 'btn small hist'; reset.id = 'reset-edits'; reset.title = 'מחזיר את התמונה כמו שנכנסה: בלי עריכה, מסגרת, טקסט או AI'; reset.textContent = '⟲ איפוס'; reset.disabled = true;
  reset.addEventListener('click', function () { if (confirm('למחוק את כל העריכה ולחזור לתמונה המקורית? (אפשר לבטל עם "ביטול")')) { FS.resetEdits(); FS.toast('⟲ חזרה לתמונה המקורית. "↶ ביטול" מחזיר את העריכה.', 4000); } });
  quick.appendChild(reset);
  /* cancelling an AI design is one click away whenever the photo on screen has one */
  var aiUndo = document.createElement('button'); aiUndo.className = 'btn small hist ai-undo'; aiUndo.id = 'ai-undo'; aiUndo.hidden = true;
  aiUndo.title = 'מבטל את עיצוב ה־AI האחרון בתמונה הזאת (לחיצה נוספת: עוד צעד אחורה, עד המקור)'; aiUndo.textContent = '↩ ביטול AI';
  aiUndo.addEventListener('click', function () {
    var p = FS.cur(); if (!p || !FS.unstyleStep) return;
    if (FS.unstyleStep(p)) { FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); FS.toast(p.origSrc ? '↩ חזרה לעיצוב ה־AI הקודם' : '↩ עיצוב ה־AI בוטל: התמונה המקורית חזרה', 3500); }
    syncAiUndo();
  });
  quick.appendChild(aiUndo);
  function syncAiUndo() { var p = FS.cur(); aiUndo.hidden = !(p && p.origSrc); }
  FS.on('history', syncAiUndo); FS.on('doc', syncAiUndo);
  ['#compare', '#fmt'].forEach(function (s) { var el = $(s); if (el) quick.appendChild(el); });
  bar.insertBefore(quick, info);
  FS.emit('history');
  var sb = $('#sizes-btn'); if (sb) sb.addEventListener('click', function () { FS.manageSizes(); });
  var act = document.createElement('div'); act.className = 'sb-act';
  ['#quick-print', '#quick-save'].forEach(function (s) { var el = $(s); if (el) { el.classList.add('small'); act.appendChild(el); } });

  /* ☰ everything that isn't editing */
  var more = document.createElement('div'); more.className = 'sb-more';
  more.innerHTML = '<button class="btn small" id="sb-menu" aria-haspopup="true" aria-expanded="false" title="עוד">☰</button><div class="sb-menu" id="sb-menu-m" hidden></div>';
  var menu = $('#sb-menu-m', more);
  var sz = document.createElement('button'); sz.className = 'btn'; sz.textContent = '📐 גדלים (בסיסיים ושלי)'; sz.addEventListener('click', function () { FS.manageSizes(); }); menu.appendChild(sz);
  ['#biz-btn', '#pkg-btn', '#deals-btn', '.top-actions a[href="admin.html"]', '#install'].forEach(function (s) { var el = $(s); if (el) { el.classList.remove('ghost'); menu.appendChild(el); } });
  [['./', '🏠 לאתר העסק'], ['design.html?owner', '✨ מסגרת מהזמנה'], ['../portfolio/', '🧰 כל האתרים שלי']].forEach(function (l) {
    var a = document.createElement('a'); a.className = 'btn'; a.href = l[0]; a.target = '_blank'; a.rel = 'noopener'; a.textContent = l[1]; menu.appendChild(a);
  });
  /* who is using the studio, and a way out (the licence stays on this computer; signing in again needs the code) */
  var me = document.createElement('button'); me.className = 'btn'; me.addEventListener('click', function () { if (confirm('לצאת מהסטודיו? בכניסה הבאה צריך שוב את קוד ההפעלה.')) FS.gateLogout && FS.gateLogout(); });
  var L = FS.license && FS.license.get(); me.textContent = '🚪 יציאה' + (L && L.email && !(FS.account && FS.account.isAdmin()) ? ' · ' + L.email : ''); menu.appendChild(me);
  var heal = document.createElement('button'); heal.className = 'btn'; heal.textContent = '🔄 רענון מלא (אם משהו נתקע) · גרסה ' + (window.FS_V || '?'); heal.addEventListener('click', function () { if (window.FS_HEAL) window.FS_HEAL(); else location.reload(); }); menu.appendChild(heal);
  act.appendChild(more);
  /* in the desktop program: a clear ✕ that closes it (the same as the window's X; unsaved photos are asked about first) */
  var D = window.FSDesktop;
  if (D && typeof D.close === 'function') {
    var x = document.createElement('button'); x.className = 'btn small app-close'; x.id = 'app-close'; x.title = 'סגירת התוכנה'; x.setAttribute('aria-label', 'סגירת התוכנה'); x.textContent = '✕';
    x.addEventListener('click', function () { D.close(); });
    act.appendChild(x);
    var q = document.createElement('button'); q.className = 'btn'; q.textContent = '✕ סגירת התוכנה'; q.addEventListener('click', function () { D.close(); }); menu.appendChild(q);
    if (typeof D.uninstall === 'function') {
      var un = document.createElement('button'); un.className = 'btn'; un.textContent = '🗑️ הסרת התוכנה מהמחשב';
      un.addEventListener('click', function () { D.uninstall().then(function (r) { if (r && !r.ok && r.error !== 'cancelled') FS.toast('אפשר להסיר גם מ: הגדרות Windows ← אפליקציות ← "פריים־סטודיו" ← הסרה.', 7000); }); });
      menu.appendChild(un);
    }
  }
  bar.appendChild(act);
  $('#sb-menu', more).addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; this.setAttribute('aria-expanded', String(!menu.hidden)); });
  menu.addEventListener('click', function (e) { if (e.target.closest('.btn')) menu.hidden = true; });
  document.addEventListener('click', function (e) { if (!more.contains(e.target)) menu.hidden = true; });

  /* the removed tabs */
  var GONE = { event: 1, text: 1, games: 1 };
  $$('.tools [role=tab]').forEach(function (b) { if (GONE[b.dataset.tab]) b.remove(); });
  $$('[data-pane=event], [data-pane=games]').forEach(function (s) { s.hidden = true; });
  var open = FS.openTab;
  FS.openTab = function (name) { return open(GONE[name] && name !== 'text' ? 'photos' : name); };
  if (GONE[FS.prefs.tab]) FS.openTab('photos');
  /* without the event tab its template can't be switched off, so it stays off */
  if (FS.prefs.eventOn) { FS.prefs.eventOn = false; FS.savePrefs(); }
  var on = $('#ev-on'); if (on) on.checked = false;
  ['#ia-event', '#start-event'].forEach(function (s) { var el = $(s); if (el) el.hidden = true; });
})();
