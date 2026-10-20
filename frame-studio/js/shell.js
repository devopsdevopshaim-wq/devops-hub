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
  ['#undo', '#redo', '#compare', '#fmt'].forEach(function (s) { var el = $(s); if (el) quick.appendChild(el); });
  bar.insertBefore(quick, info);
  var act = document.createElement('div'); act.className = 'sb-act';
  ['#quick-print', '#quick-save'].forEach(function (s) { var el = $(s); if (el) { el.classList.add('small'); act.appendChild(el); } });

  /* ☰ everything that isn't editing */
  var more = document.createElement('div'); more.className = 'sb-more';
  more.innerHTML = '<button class="btn small" id="sb-menu" aria-haspopup="true" aria-expanded="false" title="עוד">☰</button><div class="sb-menu" id="sb-menu-m" hidden></div>';
  var menu = $('#sb-menu-m', more);
  ['#biz-btn', '#pkg-btn', '#deals-btn', '.top-actions a[href="admin.html"]', '#install'].forEach(function (s) { var el = $(s); if (el) { el.classList.remove('ghost'); menu.appendChild(el); } });
  [['./', '🧲 לאתר העסק'], ['design.html?owner', '✨ מסגרת מהזמנה'], ['../portfolio/', '🧰 כל האתרים שלי']].forEach(function (l) {
    var a = document.createElement('a'); a.className = 'btn'; a.href = l[0]; a.target = '_blank'; a.rel = 'noopener'; a.textContent = l[1]; menu.appendChild(a);
  });
  act.appendChild(more);
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
