/* 📁 The event's folder on the computer (Chrome / Edge and the desktop program: the File System Access API).
   The owner picks a folder once. Each event gets its own folder in it, with
     "מגנטים מוכנים"  every finished magnet with its frame, at print quality (JPEG, 300dpi)
     "מקור"           the files as they came in, RAW included
   Printing (and "save all") writes there by itself. "🏁 סיום האירוע" saves whatever is missing and then asks whether to
   pack all the event's folders into one ZIP next to them (written straight to the disk, so even big events fit). */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, S = FS.state, esc = FS.esc;
  var OK = !!window.showDirectoryPicker, K = 'fs-folders', DIR_DONE = 'מגנטים מוכנים', DIR_ORIG = 'מקור';
  var cfg = Object.assign({ auto: true, orig: true, name: '' }, (function () { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { return {}; } })());
  function keep() { try { localStorage.setItem(K, JSON.stringify(cfg)); } catch (e) { /* blocked */ } }
  var root = null, granted = false, queue = Promise.resolve(), counts = { done: 0, orig: 0 };

  /* ---------- the chosen folder, kept between visits (IndexedDB keeps the handle; the browser asks again for permission) ---------- */
  function idb() { return new Promise(function (ok, no) { var r = indexedDB.open('fs-folders', 1); r.onupgradeneeded = function () { r.result.createObjectStore('h'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = no; }); }
  function idbGet() { return idb().then(function (db) { return new Promise(function (ok) { var t = db.transaction('h').objectStore('h').get('root'); t.onsuccess = function () { ok(t.result || null); }; t.onerror = function () { ok(null); }; }); }).catch(function () { return null; }); }
  function idbPut(h) { return idb().then(function (db) { db.transaction('h', 'readwrite').objectStore('h').put(h, 'root'); }).catch(function () {}); }
  function permit(ask) {
    if (!root) return Promise.resolve(false);
    if (granted) return Promise.resolve(true);
    var o = { mode: 'readwrite' };
    return (root.queryPermission ? root.queryPermission(o) : Promise.resolve('granted')).then(function (st) {
      if (st === 'granted') return true;
      if (!ask || !root.requestPermission) return false;
      return root.requestPermission(o).then(function (s2) { return s2 === 'granted'; });
    }).then(function (g) { granted = g; draw(); return g; }, function () { return false; });
  }
  function pick() {
    return window.showDirectoryPicker({ id: 'frame-studio-events', mode: 'readwrite', startIn: 'pictures' }).then(function (h) {
      root = h; granted = true; idbPut(h); draw(); FS.toast('📁 התיקייה "' + h.name + '" נבחרה. כל אירוע יקבל בה תיקייה משלו.', 5000); return h;
    }).catch(function () { return null; });
  }

  /* ---------- names ---------- */
  function clean(s) { return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); }
  function today() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function eventName() {
    var lv = FS.liveCurrent && FS.liveCurrent();
    var n = clean(cfg.name) || (lv ? clean((lv.date || today()) + ' ' + lv.title) : '') || clean(today() + ' אירוע');
    return n;
  }
  function base(p) { return clean(String(p.name || 'תמונה').replace(/\.[^.]+$/, '')) || 'תמונה'; }
  function fileName(p, ext) { if (!p.efName) { var b = base(p), used = S.photos.some(function (q) { return q !== p && q.efName === b; }); p.efName = used ? b + ' ' + p.id.slice(-4) : b; } return p.efName + ext; }
  function sig(p) { var s = JSON.stringify(p.doc) + '|' + String(p.src).length + (p.copies || 1), h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }

  /* ---------- writing ---------- */
  function dir(parts) { return parts.reduce(function (ch, name) { return ch.then(function (d) { return d.getDirectoryHandle(name, { create: true }); }); }, Promise.resolve(root)); }
  function writeFile(parts, name, blob) {
    return dir(parts).then(function (d) { return d.getFileHandle(name, { create: true }); }).then(function (fh) { return fh.createWritable(); })
      .then(function (w) { return w.write(blob).then(function () { return w.close(); }); });
  }
  function rendered(p) {
    return new Promise(function (ok, no) { var c = FS.renderFull(p, 1, false); c.toBlob(function (b) { if (b) ok(b); else no(new Error('jpeg')); }, 'image/jpeg', 0.95); });
  }
  /* one photo: the finished magnet (when it changed since it was last written) and its original file once */
  function savePhoto(p, onlyOrig) {
    var ev = eventName(), jobs = [];
    var s = sig(p);
    if (!onlyOrig && p.efSig !== s) jobs.push(function () { return rendered(p).then(function (b) { return writeFile([ev, DIR_DONE], fileName(p, '.jpg'), b); }).then(function () { p.efSig = s; counts.done++; }); });
    if (cfg.orig && p.origFile && !p.efOrig) jobs.push(function () { return writeFile([ev, DIR_ORIG], clean(p.origFile.name) || fileName(p, '.jpg'), p.origFile).then(function () { p.efOrig = true; counts.orig++; }); });
    return jobs.reduce(function (ch, j) { return ch.then(j); }, Promise.resolve());
  }
  function enqueue(list, ask, label, onlyOrig) {
    var run = queue.then(function () { return permit(ask); }).then(function (g) {
      if (!g) { if (root) FS.toast('📁 צריך לאשר שוב גישה לתיקייה: לשונית "שמירה והדפסה" ← "חיבור לתיקייה".', 6000); return 0; }
      var n = 0;
      return list.reduce(function (ch, p, i) { return ch.then(function () { if (label) FS.busy(label + ' ' + (i + 1) + ' / ' + list.length); return savePhoto(p, onlyOrig).then(function () { n++; }); }); }, Promise.resolve()).then(function () { if (label) FS.busy(); draw(); return n; });
    }).catch(function (e) { FS.busy(); FS.toast('השמירה לתיקייה נכשלה: ' + ((e && e.message) || ''), 6000); return 0; });
    queue = run.catch(function () {});
    return run;
  }

  /* the original file of every photo, kept with it (a RAW keeps its bytes for the "מקור" folder) */
  var add = FS.addPhotoFile;
  FS.addPhotoFile = function (file) {
    return add(file).then(function (p) { if (p && file && file.name) { p.origFile = file; if (root && granted && cfg.auto && cfg.orig) enqueue([p], false, '', true); } return p; });
  };
  /* what is printed is written to the folder */
  FS.on('print-job', function (plan) {
    if (!root || !cfg.auto) return;
    var seen = {}, list = [];
    (plan.pages || []).forEach(function (pg) { pg.forEach(function (it) { if (it.p && !seen[it.p.id]) { seen[it.p.id] = 1; list.push(it.p); } }); });
    if (list.length) enqueue(list, false);
  });

  /* ---------- ZIP of the event's folders, streamed to the disk ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function dosTime(d) { return { t: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), d: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }
  function walk(d, prefix, out) {
    return (async function () { for await (var e of d.values()) { if (e.kind === 'directory') await walk(e, prefix + e.name + '/', out); else out.push({ path: prefix + e.name, h: e }); } })();
  }
  function zipFolder(name) {
    var enc = new TextEncoder(), files = [], central = [], off = 0, w = null;
    return root.getDirectoryHandle(name).then(function (d) { return walk(d, name + '/', files); }).then(function () {
      if (!files.length) throw new Error('התיקייה ריקה');
      return root.getFileHandle(name + '.zip', { create: true });
    }).then(function (fh) { return fh.createWritable(); }).then(function (wr) {
      w = wr;
      return files.reduce(function (ch, f, i) {
        return ch.then(function () { FS.busy('מכווץ… ' + (i + 1) + ' / ' + files.length); return f.h.getFile(); }).then(function (file) {
          return file.arrayBuffer().then(function (ab) {
            var data = new Uint8Array(ab), nm = enc.encode(f.path), crc = crc32(data), dt = dosTime(new Date(file.lastModified || Date.now()));
            if (off + data.length > 4.0e9) throw new Error('האירוע גדול מ־4GB, יותר מדי לקובץ ZIP אחד. התיקיות נשארו כמו שהן.');
            var h = new DataView(new ArrayBuffer(30));
            h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, dt.t, true); h.setUint16(12, dt.d, true);
            h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
            var c = new DataView(new ArrayBuffer(46));
            c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, dt.t, true); c.setUint16(14, dt.d, true);
            c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
            central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + data.length;
            return w.write(new Uint8Array(h.buffer)).then(function () { return w.write(nm); }).then(function () { return w.write(data); });
          });
        });
      }, Promise.resolve());
    }).then(function () {
      var size = central.reduce(function (s, a) { return s + a.length; }, 0), e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
      return central.reduce(function (ch, part) { return ch.then(function () { return w.write(part); }); }, Promise.resolve()).then(function () { return w.write(new Uint8Array(e.buffer)); }).then(function () { return w.close(); });
    }).then(function () { FS.busy(); return { n: files.length, mb: off / 1048576 }; }, function (err) { FS.busy(); if (w) w.abort && w.abort().catch(function () {}); throw err; });
  }

  /* ---------- the end of the event ---------- */
  function finish() {
    if (!OK) return FS.toast('שמירה לתיקייה במחשב עובדת בתוכנה למחשב וב־Chrome או Edge. כאן אפשר "שמירת הכל (ZIP)" בלשונית שמירה והדפסה.', 7000);
    var go = root ? permit(true) : pick().then(function (h) { return !!h; });
    go.then(function (g) {
      if (!g) return;
      var ev = eventName(), list = S.photos.slice();
      return enqueue(list, true, '💾 שומר לתיקייה "' + ev + '"…').then(function () {
        var body = FS.dialog('🏁 סיום האירוע', '<p>כל ' + list.length + ' התמונות נשמרו בתיקייה <b>' + esc(root.name + ' / ' + ev) + '</b>:<br>"' + DIR_DONE + '" (מגנטים עם המסגרת)' + (cfg.orig ? ' ו"' + DIR_ORIG + '" (הקבצים המקוריים)' : '') + '.</p>' +
          '<p><b>לכווץ את כל התיקיות של האירוע לקובץ ZIP אחד?</b><br><small>הקובץ "' + esc(ev) + '.zip" ייווצר ליד התיקייה. התיקיות עצמן נשארות.</small></p>' +
          '<div class="inline"><button class="btn primary" id="ef-zip-yes">🗜️ כן, לכווץ</button><button class="btn" id="ef-zip-no">לא, להשאיר תיקיות</button></div>');
        $('#ef-zip-no', body).addEventListener('click', function () { FS.closeDialog(); FS.toast('✔ האירוע נשמר בתיקייה "' + ev + '"', 5000); });
        $('#ef-zip-yes', body).addEventListener('click', function () {
          FS.closeDialog();
          zipFolder(ev).then(function (r) { FS.toast('🗜️ נוצר "' + ev + '.zip" · ' + r.n + ' קבצים · ' + r.mb.toFixed(0) + 'MB', 7000); }, function (e) { FS.toast('הכיווץ לא הצליח: ' + ((e && e.message) || ''), 8000); });
        });
      });
    });
  }

  /* ---------- the card at the top of "save and print" ---------- */
  var card = document.createElement('div'); card.className = 'card ef-card';
  var out = $('[data-pane=output]'); if (out) out.insertBefore(card, out.children[1] || null);
  function draw() {
    if (!OK) { card.innerHTML = '<h3>📁 תיקיית האירוע במחשב</h3><p class="hint">שמירה ישירה לתיקייה במחשב עובדת בתוכנה למחשב וב־Chrome או Edge. בדפדפן הזה משתמשים ב"שמירת הכל (ZIP)".</p>'; return; }
    card.innerHTML = '<h3>📁 תיקיית האירוע במחשב</h3>' +
      '<p class="hint">לכל אירוע נפתחת תיקייה משלו, עם "' + DIR_DONE + '" (עם המסגרת, באיכות הדפסה) ו"' + DIR_ORIG + '" (כמו שנכנסו, גם RAW).</p>' +
      '<div class="ef-row"><button class="btn small" id="ef-pick">📁 ' + (root ? 'החלפת תיקייה' : 'בחירת תיקייה') + '</button><span class="ef-root">' + (root ? (granted ? '✓ ' : '🔒 ') + esc(root.name) : 'לא נבחרה תיקייה') + '</span>' +
        (root && !granted ? '<button class="btn small primary" id="ef-grant">חיבור לתיקייה</button>' : '') + '</div>' +
      '<div class="field"><label>שם האירוע (שם התיקייה)</label><input id="ef-name" maxlength="80" placeholder="' + esc(eventName()) + '" value="' + esc(cfg.name) + '"></div>' +
      '<label class="check"><input type="checkbox" id="ef-auto"' + (cfg.auto ? ' checked' : '') + '> כל מגנט שמודפס נשמר לתיקייה מיד</label>' +
      '<label class="check"><input type="checkbox" id="ef-orig"' + (cfg.orig ? ' checked' : '') + '> לשמור גם את הקבצים המקוריים (כולל RAW)</label>' +
      '<div class="ef-row"><button class="btn small" id="ef-all">💾 שמירת כל התמונות עכשיו</button></div>' +
      '<button class="btn primary wide" id="ef-finish">🏁 סיום האירוע: שמירה וכיווץ</button>' +
      '<p class="ef-st">' + (counts.done || counts.orig ? 'נשמרו בביקור הזה: ' + counts.done + ' מגנטים' + (counts.orig ? ', ' + counts.orig + ' מקור' : '') : '') + '</p>';
    $('#ef-pick', card).addEventListener('click', pick);
    var g = $('#ef-grant', card); if (g) g.addEventListener('click', function () { permit(true); });
    $('#ef-name', card).addEventListener('change', function () { cfg.name = clean(this.value); keep(); });
    $('#ef-auto', card).addEventListener('change', function () { cfg.auto = this.checked; keep(); });
    $('#ef-orig', card).addEventListener('change', function () { cfg.orig = this.checked; keep(); });
    $('#ef-all', card).addEventListener('click', function () {
      if (!S.photos.length) return FS.toast('אין תמונות');
      (root ? permit(true) : pick().then(Boolean)).then(function (ok) { if (ok) enqueue(S.photos.slice(), true, '💾 שומר…').then(function (n) { if (n) FS.toast('💾 ' + n + ' תמונות נשמרו בתיקייה "' + eventName() + '"', 5000); }); });
    });
    $('#ef-finish', card).addEventListener('click', finish);
  }
  FS.eventFolder = { finish: finish, pick: pick, name: eventName, ok: OK };
  if (OK) idbGet().then(function (h) { root = h; return permit(false); }).then(draw); else draw();
})();
