/* 💾 Edited photos saved by themselves into a folder "ערוכות" inside the folder they came from.
   - Which: every photo with a frame on it, or changed since it came in (p._base, core.js) — the finished picture, as a JPEG
     (≤4000 px, q .93), under its own file name. Written again only when it changed since the last write.
   - Where: the folder the photo was opened from (📁 תיקייה / 📁 פתיחת תיקייה, opened read-write: p.srcDir). Photos chosen one
     by one carry no folder: the first time one of them is ready, the program asks once to choose their folder, and every
     photo without a folder is written there.
   - When: in the background, one photo at a time, only while the owner is not touching the program (FS._lastInput), so it
     never slows the work. The original is never touched, and "ערוכות" is never read back in (mate.js filesOf).
   - Where to (the "💾 ערוכות" button beside 🪶): "in the photos' folder" (above, the default), "a folder I choose" (every edited
     photo straight into that folder; the folder is kept in this computer's IndexedDB and asked for again only if Windows
     asks for permission again), or off (FS.prefs.editedMode: 'source' | 'custom' | 'off').
   Off also with FS.prefs.autoSaveEdited === false. FS.saveEditedNow() queues every photo; FS.editedSettings() opens the choice. */
(function () {
  'use strict';
  var FS = window.FS; if (!FS || !FS.snap) return;
  ['pointerdown', 'keydown', 'wheel'].forEach(function (t) { window.addEventListener(t, function () { FS._lastInput = Date.now(); }, { passive: true, capture: true }); });
  var DIR = 'ערוכות', queue = [], busy = false, told = false, warned = false, asked = false, askDir = null;
  function mode() { return FS.prefs.autoSaveEdited === false ? 'off' : (FS.prefs.editedMode || 'source'); }
  function off() { return mode() === 'off'; }
  /* the folder the owner chose, kept between openings (a folder handle is stored as it is in IndexedDB) */
  var custom = null;
  function idb(fn) { return new Promise(function (ok, no) { var r = indexedDB.open('fs-edited', 1); r.onupgradeneeded = function () { r.result.createObjectStore('h'); }; r.onerror = function () { no(r.error); }; r.onsuccess = function () { var t, q; try { t = r.result.transaction('h', 'readwrite'); q = fn(t.objectStore('h')); } catch (e) { return no(e); } t.oncomplete = function () { ok(q && q.result); }; t.onerror = function () { no(t.error); }; }; }); }
  try { idb(function (st) { return st.get('dir'); }).then(function (h) { custom = h || null; }, function () {}); } catch (e) { /* no IndexedDB */ }
  function keepDir(h) { custom = h; try { idb(function (st) { return h ? st.put(h, 'dir') : st.delete('dir'); }).catch(function () {}); } catch (e) { /* not kept */ } }
  function granted(h) { return h && h.queryPermission ? h.queryPermission({ mode: 'readwrite' }).then(function (s) { return s === 'granted'; }, function () { return false; }) : Promise.resolve(!!h); }
  function safe(n) { return String(n || 'תמונה').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'תמונה'; }
  function sig(p) { try { return JSON.stringify(p.doc); } catch (e) { return ''; } }
  function ready(p) { return p && p.doc && (p.doc.frame || (p._base && sig(p) !== p._base)) && p._savedSig !== sig(p); }
  function want(p) { if (off() || !p) return; if (queue.indexOf(p.id) < 0) queue.push(p.id); setTimeout(run, 2500); }
  FS.saveEditedNow = function (list) { (list || FS.state.photos).forEach(want); };

  /* photos that came without a folder: ask once for their folder */
  function ask() {
    if (asked || !window.showDirectoryPicker || !FS.dialog) return;
    asked = true;
    var b = FS.dialog('💾 שמירת הערוכות', '<p>התמונות הערוכות נשמרות לבד בתיקייה <b>"ערוכות"</b> בתוך התיקייה של התמונות.</p><p>חלק מהתמונות נבחרו אחת־אחת, אז צריך לבחור פעם אחת את התיקייה שלהן (ולאשר עריכה).</p>' +
      '<div class="mt-row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="mt-btn primary" id="as-pick">📁 בחירת התיקייה</button><button class="mt-btn" id="as-no">לא עכשיו</button></div>' +
      '<p class="mt-hint">בפעם הבאה: פותחים עם "📁 תיקייה", והשמירה עובדת בלי לשאול.</p>');
    b.querySelector('#as-no').addEventListener('click', function () { FS.closeDialog(); });
    b.querySelector('#as-pick').addEventListener('click', function () {
      window.showDirectoryPicker({ id: 'frame-studio-photos', mode: 'readwrite' }).then(function (d) {
        askDir = d; FS.state.photos.forEach(function (p) { if (!p.srcDir) p.srcDir = d; });
        FS.closeDialog(); FS.toast('💾 מעכשיו הערוכות נשמרות בתיקייה "' + d.name + '/' + DIR + '"', 5000); FS.saveEditedNow();
      }).catch(function () {});
    });
  }

  function write(p) {
    var k = Math.min(1, 4000 / Math.max(p.doc.w, p.doc.h)), c, s = sig(p);
    try { c = FS.renderFull(p, k, false); } catch (e) { return Promise.resolve(); }
    return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.93); }).then(function (blob) {
      if (!blob) throw new Error('blob');
      var to = mode() === 'custom' ? Promise.resolve(custom) : p.srcDir.getDirectoryHandle(DIR, { create: true });
      return to.then(function (d) { return d.getFileHandle(safe(p.srcName || p.name) + '.jpg', { create: true }); })
        .then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(blob).then(function () { return w.close(); }); });
    }).then(function () {
      p._savedSig = s; p.savedEdited = Date.now();
      if (!told) { told = true; FS.toast('💾 התמונות הערוכות נשמרות לבד בתיקייה "ערוכות" בתוך תיקיית התמונות', 6000); }
    }, function () {
      if (!warned) { warned = true; FS.toast('⚠️ לא הצלחתי לשמור בתיקייה "ערוכות" (אין הרשאת כתיבה). פותחים את התיקייה שוב עם "📁 תיקייה" ומאשרים עריכה.', 8000); }
    });
  }
  function run() {
    if (busy || off() || !queue.length) return;
    if (Date.now() - (FS._lastInput || 0) < 1500) return void setTimeout(run, 900);   /* the owner is working: later */
    var id = queue.shift(), p = FS.state.photos.filter(function (x) { return x.id === id; })[0];
    if (!p || !ready(p)) return void setTimeout(run, 0);
    if (mode() === 'custom') {
      if (!custom) { queue.unshift(id); return void FS.editedSettings(true); }
      busy = true;
      return void granted(custom).then(function (ok) {
        if (!ok) { busy = false; queue.unshift(id); return regrant(); }
        return write(p).then(function () { busy = false; setTimeout(run, 120); });
      });
    }
    if (!p.srcDir) { if (askDir) p.srcDir = askDir; else { ask(); return void setTimeout(run, 0); } }
    busy = true;
    write(p).then(function () { busy = false; setTimeout(run, 120); });
  }

  /* Windows asks again for the chosen folder (after the program was closed): one click gives it back */
  var regranting = false;
  function regrant() {
    if (regranting || !FS.dialog) return; regranting = true;
    var b = FS.dialog('💾 שמירת הערוכות', '<p>להמשיך לשמור את הערוכות בתיקייה <b>"' + FS.esc(custom.name) + '"</b>?</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mt-btn primary" id="as-ok">✔ כן, לאשר גישה</button><button class="mt-btn" id="as-set">📁 תיקייה אחרת</button></div>');
    b.querySelector('#as-ok').addEventListener('click', function () { custom.requestPermission({ mode: 'readwrite' }).then(function (s) { regranting = false; FS.closeDialog(); if (s === 'granted') run(); }, function () { regranting = false; }); });
    b.querySelector('#as-set').addEventListener('click', function () { regranting = false; FS.closeDialog(); FS.editedSettings(); });
  }
  /* "💾 ערוכות": where the edited photos go */
  FS.editedSettings = function (needFolder) {
    if (!FS.dialog) return;
    var m = mode(), can = !!window.showDirectoryPicker;
    var b = FS.dialog('💾 איפה לשמור את הערוכות', '<div class="as-set">' +
      '<label class="mt-chk-l"><input type="radio" name="as-m" value="source"' + (m === 'source' ? ' checked' : '') + '> 📁 בתיקייה "ערוכות" בתוך התיקייה של התמונות</label>' +
      '<label class="mt-chk-l"><input type="radio" name="as-m" value="custom"' + (m === 'custom' ? ' checked' : '') + '> 📌 בתיקייה שאני בוחר: <b id="as-name">' + (custom ? FS.esc(custom.name) : 'עוד לא נבחרה') + '</b></label>' +
      '<div style="margin:4px 26px 8px"><button class="mt-btn" id="as-choose"' + (can ? '' : ' disabled') + '>📁 בחירת תיקייה…</button></div>' +
      '<label class="mt-chk-l"><input type="radio" name="as-m" value="off"' + (m === 'off' ? ' checked' : '') + '> ⏸️ לא לשמור לבד</label>' +
      '<p class="mt-hint">נשמרת כל תמונה עם מסגרת או עם עריכה, כקובץ JPG באותו שם. המקור לא משתנה. השמירה קורית ברקע, כשלא עובדים על התוכנה.</p>' +
      (needFolder ? '<p class="mt-hint" style="color:#B91C1C">כדי לשמור צריך לבחור תיקייה.</p>' : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="mt-btn primary" id="as-now">💾 לשמור עכשיו את כל הערוכות</button></div></div>');
    function setMode(v) { FS.prefs.editedMode = v; FS.prefs.autoSaveEdited = v !== 'off'; FS.savePrefs(); }
    Array.prototype.forEach.call(b.querySelectorAll('[name=as-m]'), function (r) { r.addEventListener('change', function () {
      setMode(r.value); if (r.value === 'custom' && !custom) b.querySelector('#as-choose').click();
      FS.toast(r.value === 'off' ? '⏸️ השמירה האוטומטית כבויה' : r.value === 'custom' ? '📌 הערוכות יישמרו בתיקייה שבחרת' : '📁 הערוכות יישמרו ב"ערוכות" בתוך תיקיית התמונות');
    }); });
    b.querySelector('#as-choose').addEventListener('click', function () {
      if (!can) return;
      window.showDirectoryPicker({ id: 'frame-studio-edited', mode: 'readwrite' }).then(function (d) {
        keepDir(d); setMode('custom'); b.querySelector('#as-name').textContent = d.name; b.querySelector('[name=as-m][value=custom]').checked = true;
        FS.toast('📌 הערוכות יישמרו בתיקייה "' + d.name + '"', 5000); FS.saveEditedNow();
      }).catch(function () {});
    });
    b.querySelector('#as-now').addEventListener('click', function () { FS.closeDialog(); FS.saveEditedNow(); FS.toast('💾 שומר את הערוכות ברקע…', 3000); });
  };
  function button() {
    var host = document.querySelector('#mt .mt-acts'); if (!host) return setTimeout(button, 1500);
    if (document.getElementById('as-btn')) return;
    var bt = document.createElement('button'); bt.id = 'as-btn'; bt.type = 'button'; bt.className = 'mt-btn'; bt.textContent = '💾 ערוכות'; bt.title = 'איפה לשמור את התמונות הערוכות';
    bt.addEventListener('click', function () { FS.editedSettings(); }); host.appendChild(bt);
  }
  setTimeout(button, 2400);

  /* an edit, and a photo that came in with a frame already on it */
  var snap = FS.snap;
  FS.snap = function (p) { var r = snap.apply(this, arguments); want(p || (FS.cur && FS.cur())); return r; };
  FS.afterAdd = FS.afterAdd || [];
  FS.afterAdd.push(function (p) { if (p.doc && p.doc.frame) want(p); });
})();
