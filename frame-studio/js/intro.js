/* The studio's entry screen: today's line, real counts from this browser, the four ways in, and the 3D fridge with the
   studio's own magnets (a flat fridge when WebGL or the CDN is missing). Closing it opens the studio behind it. */
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
    setTimeout(function () { intro.remove(); if (stage) stage.stop(); FS.render(); }, 750);
    if (then) setTimeout(then, 280);
  }
  FS.closeIntro = close;
  $('#ia-event').addEventListener('click', function () { close(function () { FS.openTab('event'); var n = $('#ev-names'); if (n) n.focus(); }); });
  $('#ia-photos').addEventListener('change', function () { var f = this.files; close(function () { FS.addFiles(f); }); });
  $('#ia-project').addEventListener('click', function () { close(function () { $('#file-project').click(); }); });
  $('#ia-designs').addEventListener('click', function () { close(function () { $('#my-designs-btn').click(); }); });
  $('#ia-demo').addEventListener('click', function () { close(function () { $('#demo').click(); }); });
  $('#ia-skip').addEventListener('click', function () { close(); });
  $('#ia-biz').addEventListener('click', function () { close(function () { FS.openBiz(); }); });
  document.addEventListener('keydown', function k(e) { if (closed) return document.removeEventListener('keydown', k); if (e.key === 'Enter' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); close(); } if (e.key === 'Escape') close(); });
  ['dragenter', 'drop'].forEach(function (ev) { document.addEventListener(ev, function () { close(); }, { once: true }); });

  /* the magnets: the studio's own designs */
  var stage = null, canvases = null;
  var shown = Promise.all(FS.SHOWCASE.map(function (o) { return FS.magnetCanvas(o, 720); })).then(function (cs) { canvases = cs; return cs; });
  function flat() {
    var box = $('#intro-fallback'); if (box.childElementCount) return; intro.classList.add('flat');
    var pos = [[8, 6, -7], [52, 4, 5], [30, 33, -2], [64, 38, 7], [6, 60, 4], [44, 64, -6]];
    canvases.slice(0, pos.length).forEach(function (c, i) { var m = document.createElement('div'); m.className = 'fm'; m.style.cssText = 'right:' + pos[i][0] + '%;top:' + pos[i][1] + '%;--r:' + pos[i][2] + 'deg;--d:' + (0.5 + i * 0.14) + 's'; m.appendChild(c); box.appendChild(m); });
  }
  function go() {
    if (stage || !canvases) return;
    try {
      stage = window.Fridge3D.mount($('#intro3d'), canvases, {
        pointerHost: intro, fit: matchMedia('(max-width: 900px)').matches ? 1.02 : 1.1,
        onFlash: function () { intro.classList.add('flashed'); },
        onSnap: function () { intro.classList.remove('tick'); void intro.offsetWidth; intro.classList.add('tick'); }
      });
      intro.classList.add('three');
    } catch (e) { console.warn(e); flat(); }
  }
  shown.then(function () {
    if (window.Fridge3D) go(); else window.addEventListener('fridge3d:ready', go);
    setTimeout(function () { if (!stage) flat(); }, 3500);
  });
})();
