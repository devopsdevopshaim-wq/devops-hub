/* 💾 Edited photos saved by themselves: a photo that came from a folder (📁 תיקייה in the workspace, opened read-write) is
   written, after each edit settles (2.5 s), as a JPEG into a folder "ערוכות" inside the folder it came from, under its own
   name. Only a photo that changed since it came in (p._base, core.js) is written; the original is never touched; the
   "ערוכות" folder is never read back in. Off with FS.prefs.autoSaveEdited === false.
   Also notes the last time the owner touched the program (FS._lastInput), so background work (the face check) waits. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS || !FS.snap) return;
  ['pointerdown', 'keydown', 'wheel'].forEach(function (t) { window.addEventListener(t, function () { FS._lastInput = Date.now(); }, { passive: true, capture: true }); });
  var timers = {}, told = false, warned = false, DIR = 'ערוכות';
  function safe(n) { return String(n || 'תמונה').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'תמונה'; }
  function save(p) {
    if (!p || !p.srcDir || !p.doc || FS.prefs.autoSaveEdited === false) return;
    if (p._base && JSON.stringify(p.doc) === p._base) return;   /* not edited */
    var k = Math.min(1, 4000 / Math.max(p.doc.w, p.doc.h)), c;
    try { c = FS.renderFull(p, k, false); } catch (e) { return; }
    new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.93); }).then(function (blob) {
      if (!blob) throw new Error('blob');
      return p.srcDir.getDirectoryHandle(DIR, { create: true }).then(function (d) { return d.getFileHandle(safe(p.srcName || p.name) + '.jpg', { create: true }); })
        .then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(blob).then(function () { return w.close(); }); });
    }).then(function () {
      p.savedEdited = Date.now();
      if (!told) { told = true; FS.toast('💾 התמונות הערוכות נשמרות לבד בתיקייה "ערוכות" בתוך התיקייה שממנה נפתחו', 6000); }
    }, function () {
      if (!warned) { warned = true; FS.toast('⚠️ לא הצלחתי לשמור בתיקייה "ערוכות" (אין הרשאת כתיבה לתיקייה). פותחים את התיקייה שוב ומאשרים עריכה.', 8000); }
    });
  }
  var snap = FS.snap;
  FS.snap = function (p) {
    var r = snap.apply(this, arguments), q = p || (FS.cur && FS.cur());
    if (q && q.srcDir && FS.prefs.autoSaveEdited !== false) { clearTimeout(timers[q.id]); timers[q.id] = setTimeout(function () { save(q); }, 2500); }
    return r;
  };
  FS.saveEditedNow = function (list) { (list || FS.state.photos).forEach(save); };
})();
