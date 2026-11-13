/* 💾 Edited photos saved by themselves.
   - Which: every photo with a frame on it, or changed since it came in (p._base, core.js): the finished picture as a JPEG
     (≤4000 px, q .93) under its own file name, one file for each print ("name.jpg", "name (2).jpg" … by its copies). Written
     again when the picture or its copies change.
   - Where (the "💾 ערוכות" button beside 🪶; FS.prefs.editedMode): 'source', a folder "ערוכות" next to the photo (default);
     'custom', one folder the owner chose; or 'off'.
   - How: in the desktop program the program writes the files itself (FSDesktop.files: the photo's real path, any photo, no
     browser permission). In a browser, through the folder opened with 📁 תיקייה (p.srcDir, read-write); photos picked one by
     one ask once for their folder.
   - When: in the background while the owner is not touching the program (never more than 15 s late), a sweep every 15 s,
     "💾 לשמור עכשיו", and before the program closes (the desktop program waits for it: app:flush → app:flushed).
   The original is never touched, and "ערוכות" is never read back in (mate.js). FS.saveEditedNow(), FS.editedSettings(). */
(function () {
  'use strict';
  var FS = window.FS; if (!FS || !FS.snap) return;
  ['pointerdown', 'keydown', 'wheel'].forEach(function (t) { window.addEventListener(t, function () { FS._lastInput = Date.now(); }, { passive: true, capture: true }); });
  var D = window.FSDesktop, NAT = !!(D && D.files && D.files.saveEdited);
  var DIR = 'ערוכות', queue = [], since = {}, busy = false, told = false, warned = false, asked = false, askDir = null, natDir = '';
  /* the owner saves with a click (💾 שמירה) unless he turned the automatic saving on in its settings */
  if (!FS.prefs.editedClickV) { FS.prefs.editedMode = 'manual'; FS.prefs.autoSaveEdited = true; FS.prefs.editedClickV = 1; FS.savePrefs(); }   /* the owner asked for a click, once over an earlier choice */
  function mode() { return FS.prefs.autoSaveEdited === false ? 'off' : (FS.prefs.editedMode || 'manual'); }
  function off() { return mode() === 'off' || mode() === 'manual'; }
  if (NAT && D.files.editedDir) D.files.editedDir().then(function (r) { natDir = (r && r.name) || ''; }, function () {});
  /* the browser's chosen folder, kept between openings (a folder handle is stored as it is in IndexedDB) */
  var custom = null;
  function idb(fn) { return new Promise(function (ok, no) { var r = indexedDB.open('fs-edited', 1); r.onupgradeneeded = function () { r.result.createObjectStore('h'); }; r.onerror = function () { no(r.error); }; r.onsuccess = function () { var t, q; try { t = r.result.transaction('h', 'readwrite'); q = fn(t.objectStore('h')); } catch (e) { return no(e); } t.oncomplete = function () { ok(q && q.result); }; t.onerror = function () { no(t.error); }; }; }); }
  if (!NAT) try { idb(function (st) { return st.get('dir'); }).then(function (h) { custom = h || null; }, function () {}); } catch (e) { /* no IndexedDB */ }
  function keepDir(h) { custom = h; try { idb(function (st) { return h ? st.put(h, 'dir') : st.delete('dir'); }).catch(function () {}); } catch (e) { /* not kept */ } }
  function granted(h) { return h && h.queryPermission ? h.queryPermission({ mode: 'readwrite' }).then(function (s) { return s === 'granted'; }, function () { return false; }) : Promise.resolve(!!h); }
  function safe(n) { return String(n || 'תמונה').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'תמונה'; }
  function nCopies(p) { return Math.max(1, Math.min(50, p.copies == null ? 1 : Math.round(Number(p.copies) || 0))); }
  function sig(p) { try { return JSON.stringify(p.doc) + '|' + nCopies(p); } catch (e) { return ''; } }
  function edited(p) { return p && p.doc && (p.doc.frame || (p._base && JSON.stringify(p.doc) !== p._base)); }
  function ready(p) { return edited(p) && p._savedSig !== sig(p); }
  function want(p) { if (off() || !p) return; if (queue.indexOf(p.id) < 0) { queue.push(p.id); since[p.id] = since[p.id] || Date.now(); } setTimeout(run, 2500); }
  FS.saveEditedNow = function (list) { (list || FS.state.photos).forEach(want); };
  /* everything edited is already written (the program may close without asking) */
  FS.allEditedSaved = function () { return !FS.state.photos.some(ready); };
  setInterval(function () { if (!off()) FS.state.photos.forEach(function (p) { if (ready(p)) want(p); }); }, 15000);   /* copies changed, a late frame… */

  function blobOf(p) {
    var k = Math.min(1, 4000 / Math.max(p.doc.w, p.doc.h)), c;
    try { c = FS.renderFull(p, k, false); } catch (e) { return Promise.reject(e); }
    return new Promise(function (res, no) { c.toBlob(function (b) { if (b) res(b); else no(new Error('blob')); }, 'image/jpeg', 0.93); });
  }
  function done(p, s, where) {
    p._savedSig = s; p.savedEdited = Date.now(); delete since[p.id];
    if (!told) { told = true; FS.toast('💾 התמונות הערוכות נשמרות לבד ' + where, 6000); }
  }
  function fail(msg) { if (!warned) { warned = true; FS.toast('⚠️ ' + msg, 9000); } }
  /* the desktop program writes the files itself */
  function writeNative(p) {
    var s = sig(p), m = mode();
    if (m === 'custom' && !natDir) { if (!asked) { asked = true; FS.editedSettings(true); } return Promise.resolve(); }
    if (m === 'source' && !p.srcPath && !natDir) { askNative(); return Promise.resolve(); }
    return blobOf(p).then(function (b) { return b.arrayBuffer(); }).then(function (ab) {
      return D.files.saveEdited({ mode: m === 'custom' || !p.srcPath ? 'custom' : 'source', srcPath: p.srcPath || '', name: p.srcName || p.name, copies: nCopies(p), data: new Uint8Array(ab) });
    }).then(function (r) {
      if (r && r.ok) return done(p, s, m === 'custom' || !p.srcPath ? 'בתיקייה שבחרת' : 'בתיקייה "ערוכות" ליד התמונות');
      if (r && r.error === 'no-dir') return askNative();
      fail('לא הצלחתי לשמור את הערוכות' + (r && r.detail ? ': ' + r.detail : '') + '. אפשר לבחור תיקייה אחרת ב"💾 ערוכות".');
    }, function () { fail('לא הצלחתי להכין את התמונה הערוכה לשמירה.'); });
  }
  function askNative() {
    if (asked || !FS.dialog) return; asked = true;
    var b = FS.dialog('💾 שמירת הערוכות', '<p>לחלק מהתמונות לא ידוע מאיפה הן הגיעו, אז צריך לבחור פעם אחת תיקייה לערוכות שלהן.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mt-btn primary" id="as-pick">📁 בחירת תיקייה</button><button class="mt-btn" id="as-no">לא עכשיו</button></div>');
    b.querySelector('#as-no').addEventListener('click', function () { FS.closeDialog(); });
    b.querySelector('#as-pick').addEventListener('click', function () { D.files.chooseDir().then(function (r) { if (r && r.ok) { natDir = r.name; FS.closeDialog(); FS.toast('📌 הערוכות יישמרו בתיקייה "' + r.name + '"', 5000); FS.saveEditedNow(); } }); });
  }
  /* a browser: through the folder handles */
  function writeWeb(p) {
    var s = sig(p), n = nCopies(p);
    return blobOf(p).then(function (blob) {
      var to = mode() === 'custom' ? Promise.resolve(custom) : p.srcDir.getDirectoryHandle(DIR, { create: true });
      return to.then(function (d) {
        var chain = Promise.resolve();
        for (var i = 1; i <= n; i++) (function (i) { chain = chain.then(function () { return d.getFileHandle(safe(p.srcName || p.name) + (i > 1 ? ' (' + i + ')' : '') + '.jpg', { create: true }); }).then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(blob).then(function () { return w.close(); }); }); })(i);
        return chain;
      });
    }).then(function () { done(p, s, mode() === 'custom' ? 'בתיקייה שבחרת' : 'בתיקייה "ערוכות" בתוך תיקיית התמונות'); },
      function () { fail('לא הצלחתי לשמור בתיקייה "ערוכות" (אין הרשאת כתיבה). פותחים את התיקייה שוב עם "📁 תיקייה" ומאשרים עריכה.'); });
  }
  function askWeb() {
    if (asked || !window.showDirectoryPicker || !FS.dialog) return; asked = true;
    var b = FS.dialog('💾 שמירת הערוכות', '<p>התמונות הערוכות נשמרות לבד בתיקייה <b>"ערוכות"</b> בתוך התיקייה של התמונות.</p><p>חלק מהתמונות נבחרו אחת־אחת, אז צריך לבחור פעם אחת את התיקייה שלהן (ולאשר עריכה).</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mt-btn primary" id="as-pick">📁 בחירת התיקייה</button><button class="mt-btn" id="as-no">לא עכשיו</button></div>');
    b.querySelector('#as-no').addEventListener('click', function () { FS.closeDialog(); });
    b.querySelector('#as-pick').addEventListener('click', function () {
      window.showDirectoryPicker({ id: 'frame-studio-photos', mode: 'readwrite' }).then(function (d) {
        askDir = d; FS.state.photos.forEach(function (p) { if (!p.srcDir) p.srcDir = d; });
        FS.closeDialog(); FS.toast('💾 מעכשיו הערוכות נשמרות בתיקייה "' + d.name + '/' + DIR + '"', 5000); FS.saveEditedNow();
      }).catch(function () {});
    });
  }
  /* one photo, whichever way; resolves when done (or skipped) */
  function one(p) {
    if (!ready(p)) return Promise.resolve();
    if (NAT) return writeNative(p);
    if (mode() === 'custom') {
      if (!custom) { if (!asked) { asked = true; FS.editedSettings(true); } return Promise.resolve(); }
      return granted(custom).then(function (ok) { if (!ok) { regrant(); return; } return writeWeb(p); });
    }
    if (!p.srcDir) { if (askDir) p.srcDir = askDir; else { askWeb(); return Promise.resolve(); } }
    return writeWeb(p);
  }
  function run() {
    if (busy || off() || !queue.length) return;
    var id = queue[0];
    if (Date.now() - (FS._lastInput || 0) < 1500 && Date.now() - (since[id] || 0) < 15000) return void setTimeout(run, 900);   /* the owner is working: a little later */
    queue.shift();
    var p = FS.state.photos.filter(function (x) { return x.id === id; })[0];
    busy = true;
    one(p).then(function () { busy = false; setTimeout(run, 120); }, function () { busy = false; setTimeout(run, 120); });
  }
  /* everything now, one after the other (before the program closes, and "💾 לשמור עכשיו") */
  FS.saveAllEdited = function () {
    if (off()) return Promise.resolve(0);
    var list = FS.state.photos.filter(ready), n = 0;
    return list.reduce(function (ch, p, i) { return ch.then(function () { FS.busy && FS.busy('💾 שומר את הערוכות… ' + (i + 1) + '/' + list.length); return one(p).then(function () { n++; }); }); }, Promise.resolve())
      .then(function () { FS.busy && FS.busy(); return n; }, function () { FS.busy && FS.busy(); return n; });
  };
  if (D && D.onFlush) D.onFlush(function () {
    if (mode() === 'manual') {
      var waiting = FS.state.photos.filter(ready).length;
      if (!waiting || !FS.dialog) return D.flushed();
      var b = FS.dialog('💾 לשמור לפני יציאה?', '<p>יש <b>' + waiting + '</b> תמונות ערוכות שעוד לא נשמרו.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mt-btn primary" id="as-x-save">💾 לשמור ולצאת</button><button class="mt-btn" id="as-x-go">יציאה בלי לשמור</button><button class="mt-btn" id="as-x-stay">ביטול</button></div>');
      b.querySelector('#as-x-save').addEventListener('click', function () { FS.closeDialog(); FS.saveEditedByClick().then(function (n) { if (n != null) { FS.savedOnce = true; D.flushed(); } }); });
      b.querySelector('#as-x-go').addEventListener('click', function () { FS.closeDialog(); FS.savedOnce = true; D.flushed(); });
      b.querySelector('#as-x-stay').addEventListener('click', function () { FS.closeDialog(); });
      return;
    }
    var t = setTimeout(function () { D.flushed(); }, 22000);
    FS.saveAllEdited().then(function () { clearTimeout(t); D.flushed(); }, function () { clearTimeout(t); D.flushed(); });
  });

  /* 💾 שמירה: a click, a folder (Windows' own window; the last folder offered first), and every edited photo (or only the
     marked ones) written there, one file per copy. Resolves to the number saved, or null when no folder was chosen. */
  FS.saveEditedByClick = function () {
    var marked = FS.marked ? FS.marked() : [], list = (marked.length ? marked : FS.state.photos).filter(edited);
    if (!list.length) { FS.toast('אין עדיין תמונות ערוכות לשמירה (עם מסגרת או עריכה)', 4000); return Promise.resolve(0); }
    var pick = NAT ? D.files.chooseDir().then(function (r) { if (!r || !r.ok) return null; natDir = r.name; return r.name; })
      : window.showDirectoryPicker ? window.showDirectoryPicker({ id: 'frame-studio-edited', mode: 'readwrite' }).then(function (d) { keepDir(d); return d.name; }, function () { return null; })
      : Promise.resolve(null);
    return pick.then(function (name) {
      if (!name) return null;
      var n = 0, files = 0, bad = 0;
      return list.reduce(function (ch, p, i) {
        return ch.then(function () {
          FS.busy && FS.busy('💾 שומר… ' + (i + 1) + '/' + list.length);
          var s = sig(p), c = nCopies(p);
          var w = NAT ? blobOf(p).then(function (bl) { return bl.arrayBuffer(); }).then(function (ab) { return D.files.saveEdited({ mode: 'custom', name: p.srcName || p.name, copies: c, data: new Uint8Array(ab) }); }).then(function (r) { if (!r || !r.ok) throw new Error((r && (r.detail || r.error)) || 'save'); })
            : blobOf(p).then(function (blob) { var chain = Promise.resolve(); for (var k = 1; k <= c; k++) (function (k) { chain = chain.then(function () { return custom.getFileHandle(safe(p.srcName || p.name) + (k > 1 ? ' (' + k + ')' : '') + '.jpg', { create: true }); }).then(function (fh) { return fh.createWritable(); }).then(function (wr) { return wr.write(blob).then(function () { return wr.close(); }); }); })(k); return chain; });
          return w.then(function () { p._savedSig = s; p.savedEdited = Date.now(); n++; files += c; }, function () { bad++; });
        });
      }, Promise.resolve()).then(function () {
        FS.busy && FS.busy();
        if (FS.dialog) {
          var b = FS.dialog('💾 נשמר', '<p>✔ נשמרו <b>' + n + '</b> תמונות (' + files + ' קבצים, קובץ לכל הדפסה) בתיקייה <b>"' + FS.esc(name) + '"</b>.' + (bad ? '<br>⚠️ ' + bad + ' לא נשמרו.' : '') + '</p>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (NAT && D.files.openDir ? '<button class="mt-btn primary" id="as-open">📂 פתיחת התיקייה</button>' : '') + '<button class="mt-btn" id="as-ok2">סגירה</button></div>');
          var o = b.querySelector('#as-open'); if (o) o.addEventListener('click', function () { D.files.openDir(); FS.closeDialog(); });
          b.querySelector('#as-ok2').addEventListener('click', function () { FS.closeDialog(); });
        }
        return n;
      });
    });
  };

  /* the browser asks again for the chosen folder (after the program was closed): one click gives it back */
  var regranting = false;
  function regrant() {
    if (regranting || !FS.dialog) return; regranting = true;
    var b = FS.dialog('💾 שמירת הערוכות', '<p>להמשיך לשמור את הערוכות בתיקייה <b>"' + FS.esc(custom.name) + '"</b>?</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="mt-btn primary" id="as-ok">✔ כן, לאשר גישה</button><button class="mt-btn" id="as-set">📁 תיקייה אחרת</button></div>');
    b.querySelector('#as-ok').addEventListener('click', function () { custom.requestPermission({ mode: 'readwrite' }).then(function (s) { regranting = false; FS.closeDialog(); if (s === 'granted') FS.saveEditedNow(); }, function () { regranting = false; }); });
    b.querySelector('#as-set').addEventListener('click', function () { regranting = false; FS.closeDialog(); FS.editedSettings(); });
  }
  /* "💾 ערוכות": where the edited photos go */
  FS.editedSettings = function (needFolder) {
    if (!FS.dialog) return;
    var m = mode(), can = NAT || !!window.showDirectoryPicker, cur = NAT ? natDir : custom ? custom.name : '';
    var b = FS.dialog('💾 איפה לשמור את הערוכות', '<div class="as-set">' +
      '<label class="mt-chk-l"><input type="radio" name="as-m" value="manual"' + (m === 'manual' ? ' checked' : '') + '> 👆 בלחיצה על "💾 שמירה" (בוחרים תיקייה בכל פעם)</label>' +
      '<p class="mt-hint" style="margin:2px 0 8px">או שמירה אוטומטית:</p>' +
      '<label class="mt-chk-l"><input type="radio" name="as-m" value="source"' + (m === 'source' ? ' checked' : '') + '> 📁 בתיקייה "ערוכות" ליד התמונות (בתוך התיקייה שלהן)</label>' +
      '<label class="mt-chk-l"><input type="radio" name="as-m" value="custom"' + (m === 'custom' ? ' checked' : '') + '> 📌 בתיקייה שאני בוחר: <b id="as-name">' + (cur ? FS.esc(cur) : 'עוד לא נבחרה') + '</b></label>' +
      '<div style="margin:4px 26px 8px"><button class="mt-btn" id="as-choose"' + (can ? '' : ' disabled') + '>📁 בחירת תיקייה…</button></div>' +
      '<label class="mt-chk-l"><input type="radio" name="as-m" value="off"' + (m === 'off' ? ' checked' : '') + '> ⏸️ לא לשמור לבד</label>' +
      '<p class="mt-hint">נשמרת כל תמונה עם מסגרת או עם עריכה, כקובץ JPG באותו שם, וקובץ לכל הדפסה (שם (2), שם (3)…) לפי הכפילויות. המקור לא משתנה. השמירה קורית תוך כדי עבודה וגם לפני שהתוכנה נסגרת.</p>' +
      (needFolder ? '<p class="mt-hint" style="color:#B91C1C">📍 לאן לשמור את התמונות הערוכות? בוחרים תיקייה פעם אחת, ומשם הכל נשמר לבד.</p>' : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="mt-btn primary" id="as-now">💾 לשמור עכשיו את כל הערוכות</button></div></div>');
    function setMode(v) { FS.prefs.editedMode = v; FS.prefs.autoSaveEdited = v !== 'off'; FS.savePrefs(); }
    function chosen(name) { setMode('custom'); b.querySelector('#as-name').textContent = name; b.querySelector('[name=as-m][value=custom]').checked = true; FS.toast('📌 הערוכות יישמרו בתיקייה "' + name + '"', 5000); asked = false; FS.saveEditedNow(); }
    Array.prototype.forEach.call(b.querySelectorAll('[name=as-m]'), function (r) { r.addEventListener('change', function () {
      setMode(r.value); if (r.value === 'custom' && !(NAT ? natDir : custom)) b.querySelector('#as-choose').click();
      FS.toast(r.value === 'manual' ? '👆 שומרים בלחיצה על "💾 שמירה"' : r.value === 'off' ? '⏸️ השמירה האוטומטית כבויה' : r.value === 'custom' ? '📌 הערוכות יישמרו בתיקייה שבחרת' : '📁 הערוכות יישמרו ב"ערוכות" ליד התמונות');
      if (r.value !== 'off' && r.value !== 'manual') FS.saveEditedNow();
    }); });
    b.querySelector('#as-choose').addEventListener('click', function () {
      if (NAT) return D.files.chooseDir().then(function (r) { if (r && r.ok) { natDir = r.name; chosen(r.name); } });
      if (!window.showDirectoryPicker) return;
      window.showDirectoryPicker({ id: 'frame-studio-edited', mode: 'readwrite' }).then(function (d) { keepDir(d); chosen(d.name); }).catch(function () {});
    });
    b.querySelector('#as-now').addEventListener('click', function () { FS.closeDialog(); FS.saveAllEdited().then(function (n) { FS.toast(n ? '💾 נשמרו ' + n + ' תמונות ערוכות' : 'אין תמונות ערוכות חדשות לשמירה', 4000); }); });
  };
  function button() {
    var host = document.querySelector('#mt .mt-acts'); if (!host) return setTimeout(button, 1500);
    if (document.getElementById('as-btn')) return;
    var bt = document.createElement('button'); bt.id = 'as-btn'; bt.type = 'button'; bt.className = 'mt-btn primary'; bt.textContent = '💾 שמירה'; bt.title = 'שמירת התמונות הערוכות (או המסומנות) לתיקייה שבוחרים, קובץ לכל הדפסה';
    bt.addEventListener('click', function () { FS.saveEditedByClick(); });
    var gs = document.createElement('button'); gs.id = 'as-set-btn'; gs.type = 'button'; gs.className = 'mt-btn'; gs.textContent = '⚙'; gs.title = 'הגדרות השמירה (גם שמירה אוטומטית)';
    gs.addEventListener('click', function () { FS.editedSettings(); });
    host.insertBefore(gs, host.firstChild); host.insertBefore(bt, host.firstChild);
  }
  setTimeout(button, 2400);

  /* an edit, and a photo that came in with a frame already on it */
  var snap = FS.snap;
  FS.snap = function (p) { var r = snap.apply(this, arguments); want(p || (FS.cur && FS.cur())); return r; };
  FS.afterAdd = FS.afterAdd || [];
  FS.afterAdd.push(function (p) { if (p.doc && p.doc.frame) want(p); });
})();
