/* One undo for everything (v162). Each action is kept in one list, in the order it was done: an edit, a frame, text or design
   (FS.snap), an AI result (FS.applyAI), going back to the original (FS.unstyle, FS.unstyleStep, FS.resetEdits). "↶ ביטול"
   takes back the last action, whatever it was and on however many photos it ran (a batch on 40 photos is one step), and
   "↷ חזרה" does it again. Each step keeps, per photo, the state before it: the page (doc), the picture on it (src) and the
   AI history (origSrc, aiPrev). Steps of the same kind within 600 ms are one step (a slider drag, a batch).
   FS.undoAll(), FS.redoAll(), FS.undoInfo() → { undo: label|'', redo: label|'' }. Up to 80 steps. */
(function () {
  'use strict';
  var FS = window.FS;
  if (!FS || !FS.snap) return;
  var J = [], R = [], mute = 0, MAX = 80;
  var NAMES = { doc: 'עריכה', ai: 'עריכת AI', back: 'החזרה למקור', reset: 'איפוס עריכות' };
  function byId(id) { return FS.state.photos.filter(function (p) { return p.id === id; })[0]; }
  function state(p, doc) { return { doc: doc || JSON.stringify(p.doc), src: p.src, origSrc: p.origSrc || null, aiPrev: p.aiPrev ? p.aiPrev.slice() : null }; }
  function record(kind, p, before) {
    var now = Date.now(), last = J[J.length - 1];
    if (last && last.k === kind && now - last.t < 600) { if (!last.b[p.id]) last.b[p.id] = before; last.t = now; }
    else { var e = { k: kind, t: now, b: {} }; e.b[p.id] = before; J.push(e); if (J.length > MAX) J.shift(); }
    R = []; FS.emit && FS.emit('undo-all');
  }
  function quiet(fn) { mute++; try { return fn(); } finally { mute--; } }
  function restore(p, st) {
    p.doc = JSON.parse(st.doc); p.src = st.src;
    if (st.origSrc) p.origSrc = st.origSrc; else delete p.origSrc;
    if (st.aiPrev) p.aiPrev = st.aiPrev.slice(); else delete p.aiPrev;
    delete p.aiBad;
    p.cache = {}; p.mask = null; p.faces = null; p.maskV = (p.maskV || 0) + 1; p.quality = null; p._gt = null; p._pt = null;
    quiet(function () { snap0(p); });
  }

  /* every edit: the page before it is the last step this photo kept */
  var snap0 = FS.snap;
  FS.snap = function (p) {
    p = p || (FS.cur && FS.cur()); if (!p) return snap0.apply(this, arguments);
    if (mute || !p.undo) return snap0.call(this, p);
    if (!p.undo.length) { if (!p._base) return snap0.call(this, p); p.undo.push(p._base); }   /* the photo as it came in is the first step */
    var top = p.undo[p.undo.length - 1], n = p.undo.length, srcNow = p.src, r = snap0.call(this, p);
    if (p.undo.length !== n || p.undo[p.undo.length - 1] !== top) record('doc', p, { doc: top, src: srcNow, origSrc: p.origSrc || null, aiPrev: p.aiPrev ? p.aiPrev.slice() : null });
    return r;
  };
  /* a photo that comes in: as it is now (frame and automatic look already on) is where its undo stops */
  FS.afterAdd = FS.afterAdd || [];
  FS.afterAdd.push(function (p) { if (p && p.undo && !p.undo.length) quiet(function () { snap0(p); }); });
  /* actions that change the picture itself: the whole state before them */
  function wrap(name, kind) {
    var f = FS[name]; if (!f) return;
    FS[name] = function (p) {
      if (mute || !p) return f.apply(this, arguments);
      var before = state(p), args = arguments, self = this, r = quiet(function () { return f.apply(self, args); });
      if (r !== false && (p.src !== before.src || JSON.stringify(p.doc) !== before.doc)) record(kind, p, before);
      return r;
    };
  }
  wrap('applyAI', 'ai'); wrap('unstyle', 'back'); wrap('unstyleStep', 'back');
  /* "איפוס" runs on the photos being edited together */
  if (FS.resetEdits) {
    var reset0 = FS.resetEdits;
    FS.resetEdits = function () {
      var c = FS.cur && FS.cur(); if (!c || mute) return reset0.apply(this, arguments);
      var list = FS.targets && FS.targets().indexOf(c) >= 0 ? FS.targets() : [c], before = list.map(function (p) { return state(p); });
      var r = quiet(function () { return reset0(); });
      list.forEach(function (p, i) { if (p.src !== before[i].src || JSON.stringify(p.doc) !== before[i].doc) record('reset', p, before[i]); });
      return r;
    };
  }

  function step(from, to) {
    var e = from.pop(); if (!e) { FS.toast && FS.toast('אין מה לבטל', 2000); return false; }
    var back = { k: e.k, t: 0, b: {} }, n = 0;
    Object.keys(e.b).forEach(function (id) { var p = byId(id); if (!p) return; back.b[id] = state(p); restore(p, e.b[id]); n++; });
    to.push(back);
    FS.state.sel = null;
    FS.emit('doc'); FS.emit('history'); FS.emit('undo-all'); FS.emit('undo-step'); FS.refreshStrip && FS.refreshStrip();
    return { kind: e.k, n: n };
  }
  FS.undoAll = function () { var r = step(J, R); if (r) FS.toast('↶ בוטל: ' + NAMES[r.kind] + (r.n > 1 ? ' (' + r.n + ' תמונות)' : ''), 2500); return r; };
  FS.redoAll = function () { var r = step(R, J); if (r) FS.toast('↷ חזר: ' + NAMES[r.kind] + (r.n > 1 ? ' (' + r.n + ' תמונות)' : ''), 2500); return r; };
  function label(e) { if (!e) return ''; var n = Object.keys(e.b).length; return NAMES[e.k] + (n > 1 ? ' · ' + n + ' תמונות' : ''); }
  FS.undoInfo = function () { return { undo: label(J[J.length - 1]), redo: label(R[R.length - 1]) }; };
  /* the old per-photo buttons and keys now take back the last action too */
  FS.undo = function () { return FS.undoAll(); };
  FS.redo = function () { return FS.redoAll(); };

  /* the buttons: in the workspace's top bar (every screen), always in the same place */
  function buttons() {
    var host = document.querySelector('#mt .mt-qp'); if (!host) return setTimeout(buttons, 1200);
    if (document.getElementById('mt-undo')) return;
    var g = document.createElement('div'); g.className = 'mt-undo'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'ביטול וחזרה');
    g.innerHTML = '<button class="mt-btn" id="mt-undo" type="button">↶ ביטול</button><button class="mt-btn mt-ic" id="mt-redo" type="button" aria-label="חזרה">↷</button>';
    host.parentNode.insertBefore(g, host);
    var u = g.querySelector('#mt-undo'), r = g.querySelector('#mt-redo');
    u.addEventListener('click', function () { FS.undoAll(); });
    r.addEventListener('click', function () { FS.redoAll(); });
    function sync() { var i = FS.undoInfo(); u.disabled = !i.undo; r.disabled = !i.redo; u.title = i.undo ? 'ביטול: ' + i.undo + ' (Ctrl+Z)' : 'אין מה לבטל'; r.title = i.redo ? 'חזרה: ' + i.redo + ' (Ctrl+Y)' : 'אין מה להחזיר'; }
    FS.on('undo-all', sync); FS.on('history', sync); sync();
  }
  setTimeout(buttons, 1500);
})();
