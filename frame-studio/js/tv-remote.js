/* 📺 The hall screen (wall.html) run from the studio (Optimus). Every 2 seconds the screen asks the server whether the
   studio changed anything (action 'tv', cheap: no photo list). It switches between the three screens by itself (the owners'
   screen, the slideshow, the live mosaic) and reloads on command; the owners' screen (host-wall.js) listens through
   FLTV.on(fn) for the rest: settings, pause, next, a message on the screen, a guest's photo shown large. */
(function () {
  'use strict';
  var L = window.FL; if (!L || !L.e || !L.v) return;
  var q = location.search, mode = /[?&]host=1/.test(q) ? 'host' : /[?&]mosaic=1/.test(q) ? 'mosaic' : 'wall';
  var seq = -1, subs = [], lastCmd = null, name = '';
  try { name = localStorage.getItem('fs-tv-name') || ''; } catch (e) { /* private */ }
  if (!name) { name = (/SMART-TV|SmartTV|Tizen|Web0S|webOS|BRAVIA|AFT|CrKey|GoogleTV|Android TV/i.test(navigator.userAgent) ? 'טלוויזיה' : 'מסך') + ' ' + Math.random().toString(36).slice(2, 5).toUpperCase(); try { localStorage.setItem('fs-tv-name', name); } catch (e) { /* private */ } }
  function url(m) { var u = 'wall.html?e=' + L.e + '&v=' + L.v; return m === 'host' ? u + '&host=1' : m === 'mosaic' ? u + '&mosaic=1' : u; }
  function tick() {
    return L.call({ action: 'tv', e: L.e, v: L.v, seq: seq, name: name }).then(function (r) {
      if (!r || !r.ok || r.same) return;
      seq = r.seq;
      var want = r.set && r.set.mode;
      if (want && want !== mode) { location.replace(url(want)); return; }
      var list = (r.cmds && r.cmds.length ? r.cmds : r.cmd ? [r.cmd] : []), top = list.reduce(function (m, c) { return Math.max(m, c.n || 0); }, 0);
      var fresh = lastCmd === null ? [] : list.filter(function (c) { return c.n > lastCmd; });   /* commands sent before this screen opened are not replayed */
      lastCmd = Math.max(lastCmd || 0, top);
      if (fresh.some(function (c) { return c.c === 'reload'; })) { location.reload(); return; }
      subs.forEach(function (fn) { try { fn(r, null); } catch (e) { /* one listener */ } });
      fresh.forEach(function (c) { subs.forEach(function (fn) { try { fn(r, c, true); } catch (e) { /* one listener */ } }); });
    });
  }
  window.FLTV = { on: function (fn) { subs.push(fn); }, mode: mode, name: name, tick: tick };
  setTimeout(function loop() { tick().then(function () { setTimeout(loop, document.hidden ? 6000 : 2000); }, function () { setTimeout(loop, 5000); }); }, 300);
})();
