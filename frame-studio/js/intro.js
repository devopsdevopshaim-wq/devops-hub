/* The studio's entry screen: today's line, real counts from this browser, the four ways in, and a designer's portfolio
   wall of the studio's own work (plain images and CSS, no WebGL, so it opens at once). Closing it opens the studio. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$;
  var intro = $('#intro'); if (!intro) return;
  if (/[?&]skip\b/.test(location.search)) { intro.remove(); return; }
  document.body.classList.add('intro-on');

  var d = new Date();
  $('#intro-today').textContent = 'מוכן לאירוע · ' + d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  /* real numbers from this browser only; a number that is zero is left out */
  function stat(n, label) { return n ? '<li><b>' + n.toLocaleString('he-IL') + '</b><span>' + label + '</span></li>' : ''; }
  var events = 0, printed = 0; try { events = JSON.parse(localStorage.getItem('frame-studio-events') || '[]').length; printed = Number(localStorage.getItem('frame-studio-printed') || 0); } catch (e) { /* private mode */ }
  FS.loadUserFrames().then(function () {
    var html = stat(events, 'אירועים שמורים') + stat(printed, 'מגנטים הודפסו') + stat(Object.keys(FS.USER_FRAMES).length, 'מסגרות שלי');
    $('#intro-stats').innerHTML = html || '<li class="first"><span>פעם ראשונה כאן? מתחילים ב"אירוע חדש".</span></li>';
  });

  var closed = false;
  function close(then) {
    if (closed) return; closed = true;
    intro.classList.add('leaving'); document.body.classList.remove('intro-on');
    setTimeout(function () { intro.remove(); FS.render(); }, 750);
    if (then) setTimeout(then, 280);
  }
  FS.closeIntro = close;
  $('#ia-event').addEventListener('click', function () { close(function () { FS.openTab('event'); var n = $('#ev-names'); if (n) n.focus(); }); });
  $('#ia-photos').addEventListener('change', function () { var f = this.files; close(function () { FS.addFiles(f); }); });
  $('#ia-project').addEventListener('click', function () { close(function () { $('#file-project').click(); }); });
  $('#ia-designs').addEventListener('click', function () { close(function () { $('#my-designs-btn').click(); }); });
  $('#ia-skip').addEventListener('click', function () { close(); });
  document.addEventListener('keydown', function k(e) { if (closed) return document.removeEventListener('keydown', k); if (e.key === 'Enter' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); close(); } if (e.key === 'Escape') close(); });
  ['dragenter', 'drop'].forEach(function (ev) { document.addEventListener(ev, function () { close(); }, { once: true }); });

  /* the portfolio: three columns of the studio's work drifting slowly, each piece matted like a print on a wall */
  var WORK = [['p-noir', 'נואר'], ['p-sketch', 'סקיצה'], ['p-pop', 'פופ־ארט'], ['p-oldphoto', 'וינטג׳'], ['p-stained', 'ויטראז׳'], ['p-manga', 'מנגה'],
    ['p-mosaic', 'פסיפס'], ['p-comic', 'קומיקס'], ['p-neon', 'ניאון'], ['p-cartoon', 'איור'], ['p-graffiti', 'גרפיטי'], ['p-original', 'מקור']];
  var folio = $('#folio');
  if (folio) {
    var cols = [[], [], []];
    WORK.forEach(function (w, i) { cols[i % 3].push([w[0], w[1], i + 1]); });
    folio.innerHTML = cols.map(function (c, ci) {
      var items = c.map(function (w, i) { var n = String(w[2]).padStart(2, '0'); return '<figure><img src="show/' + w[0] + '.webp" alt="" loading="' + (i < 2 ? 'eager' : 'lazy') + '" decoding="async" width="640" height="640" /><figcaption><i>' + n + '</i>' + w[1] + '</figcaption></figure>'; }).join('');
      return '<div class="fcol" style="--dur:' + (46 + ci * 9) + 's"><div class="ftrack">' + items + items + '</div></div>';
    }).join('');
  }
})();
