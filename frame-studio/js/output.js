/* Out: files (JPG, PNG, WEBP, PDF, ZIP of all), project files, "my designs" in the browser, a design saved as a new frame,
   sharing, and printing through the computer's own print dialog (any installed printer) at true paper size. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;
  var outType = 'jpeg';

  $$('#out-type [data-t]').forEach(function (b) { b.addEventListener('click', function () {
    outType = b.dataset.t; $$('#out-type [data-t]').forEach(function (x) { x.classList.toggle('on', x === b); });
    $('#q-row').hidden = outType === 'png'; $('#out-transparent').disabled = outType !== 'png';
  }); });
  $('#out-q').addEventListener('input', function () { $('#o-q').textContent = this.value + '%'; });

  /* the finished page at `scale` × its print size */
  FS.renderFull = function (p, scale, transparent) {
    var d = p.doc, im = FS.img(p.src), c = FS.canvas(d.w * scale, d.h * scale);
    var need = im ? Math.min(Math.max(im.naturalWidth, im.naturalHeight), Math.max(800, Math.max(im.naturalWidth, im.naturalHeight) * d.photo.s * scale * 1.05)) : 1000;
    FS.draw(c.getContext('2d'), p, { scale: scale, max: Math.min(6000, Math.round(need)), export: true, transparent: transparent });
    return c;
  };
  function ready() { return document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(); }
  function toBlob(c, type, q) { return new Promise(function (res) { c.toBlob(res, 'image/' + type, q); }); }
  function download(blob, name) { var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }
  FS.download = download;
  function safe(n) { return String(n || 'תמונה').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60); }
  function opts() { return { scale: Number($('#out-scale').value), q: Number($('#out-q').value) / 100, transparent: outType === 'png' && $('#out-transparent').checked }; }
  function fileOf(p, o) {
    var c = FS.renderFull(p, o.scale, o.transparent);
    return toBlob(c, outType === 'pdf' ? 'jpeg' : outType, o.q).then(function (b) { return { blob: b, name: safe(p.name) + '.' + (outType === 'jpeg' ? 'jpg' : outType), canvas: c }; });
  }

  /* ---------- PDF: one JPEG per page at the page's true size, written directly (no library, works offline) ---------- */
  function mmOf(d) { var f = FS.fmt(d.fmt); return f && f.mm ? f.mm : [d.w / 300 * 25.4, d.h / 300 * 25.4]; }
  FS.pdf = function (pages) { /* [{jpeg: Uint8Array, w, h (px), mm:[w,h]}] */
    var enc = new TextEncoder(), parts = [], offs = [], len = 0, n = 2 + pages.length * 3;
    function put(x) { var u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; }
    function obj(i, body, stream) { offs[i] = len; put(i + ' 0 obj\n' + body); if (stream) { put('\nstream\n'); put(stream); put('\nendstream'); } put('\nendobj\n'); }
    put('%PDF-1.4\n%\xE2\xE3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map(function (_, i) { return (3 + i * 3) + ' 0 R'; }).join(' ') + '] >>');
    pages.forEach(function (pg, i) {
      var W = (pg.mm[0] * 72 / 25.4).toFixed(2), H = (pg.mm[1] * 72 / 25.4).toFixed(2), o = 3 + i * 3, cs = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q';
      obj(o, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + (o + 2) + ' 0 R >> >> /Contents ' + (o + 1) + ' 0 R >>');
      obj(o + 1, '<< /Length ' + cs.length + ' >>', enc.encode(cs));
      obj(o + 2, '<< /Type /XObject /Subtype /Image /Width ' + pg.w + ' /Height ' + pg.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + pg.jpeg.length + ' >>', pg.jpeg);
    });
    var x = len, xref = 'xref\n0 ' + (n + 1) + '\n0000000000 65535 f \n';
    for (var i = 1; i <= n; i++) xref += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    put(xref + 'trailer\n<< /Size ' + (n + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  };
  function makePdf(list, o) {
    var pages = [], chain = Promise.resolve();
    list.forEach(function (p) { chain = chain.then(function () {
      var c = FS.renderFull(p, o.scale, false);
      return toBlob(c, 'jpeg', o.q).then(function (b) { return b.arrayBuffer(); }).then(function (ab) { pages.push({ jpeg: new Uint8Array(ab), w: c.width, h: c.height, mm: mmOf(p.doc) }); });
    }); });
    return chain.then(function () { return FS.pdf(pages); });
  }

  /* ---------- ZIP (stored, no library) ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  FS.zip = function (files) { /* [{name, data:Uint8Array}] */
    var enc = new TextEncoder(), parts = [], central = [], off = 0, used = {};
    files.forEach(function (f) {
      var nm = f.name, n = 1; while (used[nm]) nm = f.name.replace(/(\.[^.]+)?$/, ' (' + (++n) + ')$1'); used[nm] = 1;
      var name = enc.encode(nm), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, f.data);
      var c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + f.data.length;
    });
    var size = central.reduce(function (s, a) { return s + a.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
  };

  /* ---------- save buttons ---------- */
  function need() { if (!FS.cur()) { FS.toast('אין עדיין תמונה'); return false; } return true; }
  FS.saveCurrent = function () {
    if (!need()) return; var p = FS.cur(), o = opts(); FS.busy('מכין קובץ…');
    ready().then(function () { return outType === 'pdf' ? makePdf([p], o).then(function (b) { return { blob: b, name: safe(p.name) + '.pdf' }; }) : fileOf(p, o); })
      .then(function (f) { FS.busy(); download(f.blob, f.name); FS.savedOnce = true; FS.toast('✔ נשמר: ' + f.name); })
      .catch(function () { FS.busy(); FS.toast('השמירה לא הצליחה'); });
  };
  $('#save-one').addEventListener('click', FS.saveCurrent);
  $('#quick-save').addEventListener('click', function () { FS.openTab('output'); FS.saveCurrent(); });
  $('#save-all').addEventListener('click', function () {
    if (!need()) return; var o = opts(), list = S.photos.slice(); FS.busy('מכין ' + list.length + ' קבצים…');
    ready().then(function () {
      if (outType === 'pdf') return makePdf(list, o).then(function (b) { download(b, 'פריים־סטודיו.pdf'); });
      var chain = Promise.resolve(), files = [];
      list.forEach(function (p, i) { chain = chain.then(function () { FS.busy('מכין ' + (i + 1) + '/' + list.length + '…'); return fileOf(p, o).then(function (f) { return f.blob.arrayBuffer().then(function (ab) { files.push({ name: f.name, data: new Uint8Array(ab) }); }); }); }); });
      return chain.then(function () { download(FS.zip(files), 'פריים־סטודיו.zip'); });
    }).then(function () { FS.busy(); FS.savedOnce = true; FS.toast('✔ כל התמונות נשמרו'); }).catch(function () { FS.busy(); FS.toast('השמירה לא הצליחה'); });
  });

  /* ---------- project files and "my designs" ---------- */
  function projectOf(list) {
    var frames = {};
    list.forEach(function (p) { var f = p.doc.frame; if (f && f.kind === 'png' && FS.USER_FRAMES[f.id]) { var u = FS.USER_FRAMES[f.id]; frames[f.id] = { name: u.name, src: u.src, hole: u.hole, solid: u.solid }; } });
    return { app: 'frame-studio', v: 1, savedAt: new Date().toISOString(), frames: frames, photos: list.map(function (p) { return { name: p.name, src: p.src, doc: p.doc }; }) };
  }
  FS.openProject = function (proj) {
    if (!proj || proj.app !== 'frame-studio') { FS.toast('זה לא קובץ של פריים־סטודיו'); return Promise.resolve(); }
    FS.busy('פותח פרויקט…');
    var fr = Object.keys(proj.frames || {}).map(function (id) { var f = proj.frames[id];
      return FS.loadImg(f.src).then(function (img) { FS.USER_FRAMES[id] = { id: id, name: f.name, src: f.src, hole: f.hole, solid: f.solid, aspect: img.naturalWidth / img.naturalHeight };
        return FS.store.put('frames', { id: id, name: f.name, src: f.src, hole: f.hole, solid: f.solid, at: Date.now() }).catch(function () {}); }); });
    var srcs = [];
    proj.photos.forEach(function (ph) { srcs.push(ph.src); ph.doc.layers.forEach(function (L) { if (L.src) srcs.push(L.src); }); if (ph.doc.photo.bg && ph.doc.photo.bg.src) srcs.push(ph.doc.photo.bg.src); });
    return Promise.all(fr.concat(srcs.map(function (s) { return FS.loadImg(s).catch(function () {}); }))).then(function () {
      var first = S.photos.length;
      proj.photos.forEach(function (ph) { var p = { id: FS.uid(), name: ph.name, src: ph.src, doc: ph.doc, undo: [], redo: [], cache: {} }; S.photos.push(p); FS.snap(p); });
      FS.busy(); FS.buildStrip(); FS.select(first); FS.toast('✔ הפרויקט נפתח');
    }).catch(function () { FS.busy(); FS.toast('הפרויקט לא נפתח'); });
  };
  $('#save-project').addEventListener('click', function () {
    if (!need()) return;
    download(new Blob([JSON.stringify(projectOf(S.photos))], { type: 'application/json' }), 'פרויקט ' + new Date().toISOString().slice(0, 10) + '.fstudio.json');
    FS.savedOnce = true; FS.toast('✔ קובץ הפרויקט נשמר. פותחים אותו ב"פתיחת פרויקט" וממשיכים לערוך.');
  });
  $('#open-project').addEventListener('click', function () { $('#file-project').click(); });
  $('#file-project').addEventListener('change', function () {
    var f = this.files[0]; this.value = ''; if (!f) return;
    f.text().then(function (t) { return FS.openProject(JSON.parse(t)); }).catch(function () { FS.toast('הקובץ לא נקרא'); });
  });
  $('#save-design').addEventListener('click', function () {
    if (!need()) return; var p = FS.cur(), name = prompt('שם לעיצוב:', p.name); if (name == null) return;
    var th = FS.thumbOf(p, 260).toDataURL('image/jpeg', 0.8);
    FS.store.put('designs', { id: 'd' + FS.uid(), name: name || p.name, at: Date.now(), thumb: th, project: projectOf([p]) })
      .then(function () { FS.savedOnce = true; FS.toast('✔ נשמר ב"העיצובים שלי"'); }).catch(function () { FS.toast('אין מקום בדפדפן. שומרים קובץ פרויקט במקום.', 5000); });
  });
  $('#my-designs-btn').addEventListener('click', showDesigns);
  function showDesigns() {
    FS.store.all('designs').then(function (list) {
      list = (list || []).sort(function (a, b) { return b.at - a.at; });
      var body = FS.dialog('העיצובים שלי', list.length ? '<div class="designs">' + list.map(function (d) {
        return '<figure data-id="' + d.id + '"><img src="' + d.thumb + '" alt=""><figcaption><b>' + FS.esc(d.name) + '</b><small>' + new Date(d.at).toLocaleString('he-IL') + '</small></figcaption>' +
          '<div><button class="btn small primary" data-open>פתיחה</button><button class="btn small danger" data-del>מחיקה</button></div></figure>';
      }).join('') + '</div>' : '<p class="empty">עדיין לא שמרת עיצובים. בלשונית "שמירה והדפסה" לוחצים על "לעיצובים שלי".</p>', true);
      $$('figure', body).forEach(function (f) {
        var d = list.filter(function (x) { return x.id === f.dataset.id; })[0];
        $('[data-open]', f).addEventListener('click', function () { FS.closeDialog(); FS.openProject(d.project); });
        $('[data-del]', f).addEventListener('click', function () { if (confirm('למחוק את "' + d.name + '"?')) FS.store.del('designs', d.id).then(showDesigns); });
      });
    }).catch(function () { FS.toast('הדפדפן לא מאפשר שמירה מקומית'); });
  }
  $('#save-as-frame').addEventListener('click', function () {
    if (!need()) return; var p = FS.cur();
    if (!p.doc.frame && !p.doc.layers.length) { FS.toast('מוסיפים מסגרת, טקסט או מדבקות, ואז שומרים אותם כמסגרת חדשה'); return; }
    var name = prompt('שם למסגרת החדשה:', 'המסגרת שלי'); if (name == null) return;
    ready().then(function () {
      var k = Math.min(1, 2400 / Math.max(p.doc.w, p.doc.h)), c = FS.canvas(p.doc.w * k, p.doc.h * k);
      FS.draw(c.getContext('2d'), p, { scale: k, transparent: true, noPhoto: true, export: true });
      return FS.addUserFrame(c.toDataURL('image/png'), name || 'המסגרת שלי').then(function (f) {
        download(dataBlob(c.toDataURL('image/png')), safe(name) + '.png');
        FS.toast(f.solid ? 'המסגרת נשמרה, אבל אין בה חלון שקוף' : '✔ נשמרה ב"המסגרות שלי" וגם כקובץ PNG', 5000);
        if (FS.buildFrames) FS.buildFrames();
      });
    });
  });
  function dataBlob(u) { var b = atob(u.split(',')[1]), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return new Blob([a], { type: u.slice(5, u.indexOf(';')) }); }
  $('#share').addEventListener('click', function () {
    if (!need()) return; var p = FS.cur(), o = opts(); if (outType === 'pdf') outType = 'jpeg';
    ready().then(function () { return fileOf(p, o); }).then(function (f) {
      var file = new File([f.blob], f.name, { type: f.blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: p.name }).catch(function () {});
      download(f.blob, f.name); FS.toast('במחשב הזה אין שיתוף ישיר, אז הקובץ ירד ואפשר לצרף אותו');
    });
  });

  /* ---------- print ---------- */
  var PAPERS = [['10x15', 'תמונה 10×15', 102, 152], ['13x18', '13×18', 127, 178], ['15x20', '15×20', 152, 203], ['20x30', '20×30', 203, 305],
    ['A6', 'A6', 105, 148], ['A5', 'A5', 148, 210], ['A4', 'A4', 210, 297], ['A3', 'A3', 297, 420], ['Letter', 'Letter', 215.9, 279.4], ['sq15', 'ריבוע 15×15', 152, 152], ['10x10', 'ריבוע 10×10', 102, 102], ['card', 'כרטיס 5.4×8.6', 54, 86]];
  $('#paper').innerHTML = PAPERS.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + ' (' + p[2] + '×' + p[3] + ' מ"מ)</option>'; }).join('');
  $('#paper').value = FS.prefs.paper || '10x15';
  ['paper', 'layout', 'margin'].forEach(function (k) { if (FS.prefs['print_' + k]) $('#' + k).value = FS.prefs['print_' + k]; $('#' + k).addEventListener('change', function () { FS.prefs['print_' + k] = this.value; FS.savePrefs(); }); });

  function rotated(c) { var r = FS.canvas(c.height, c.width), x = r.getContext('2d'); x.translate(r.width, 0); x.rotate(Math.PI / 2); x.drawImage(c, 0, 0); return r; }
  FS.printNow = function () {
    if (!need()) return;
    var paper = PAPERS.filter(function (p) { return p[0] === $('#paper').value; })[0], layout = $('#layout').value, mg = Number($('#margin').value);
    var copies = FS.clamp(Number($('#copies').value) || 1, 1, 50), list = $('#print-all').checked ? S.photos.slice() : [FS.cur()], marks = $('#print-marks').checked;
    FS.busy('מכין להדפסה…');
    ready().then(function () {
      var imgs = [];
      list.forEach(function (p) { var k = Math.min(1, 3600 / Math.max(p.doc.w, p.doc.h)), c = FS.renderFull(p, k, false); for (var i = 0; i < copies; i++) imgs.push({ c: c, mm: mmOf(p.doc) }); });
      var pw = paper[2], ph = paper[3];
      /* decide the cells on a page */
      var cells = [];
      function grid(cols, rows) { var cw = (pw - mg * 2) / cols, chh = (ph - mg * 2) / rows; for (var r = 0; r < rows; r++) for (var q = 0; q < cols; q++) cells.push({ x: mg + q * cw, y: mg + r * chh, w: cw, h: chh }); }
      if (layout === 'one') grid(1, 1);
      else if (layout === '2') { if (ph >= pw) grid(1, 2); else grid(2, 1); }
      else if (layout === '4') grid(2, 2);
      else if (layout === '9') grid(3, 3);
      else { /* as many as fit at their true size */
        var m0 = imgs[0].mm, a = Math.min(m0[0], m0[1]), b = Math.max(m0[0], m0[1]), aw = pw - mg * 2, ah = ph - mg * 2, gap = mg ? 2 : 0;
        var o1 = Math.floor((aw + gap) / (a + gap)) * Math.floor((ah + gap) / (b + gap)), o2 = Math.floor((aw + gap) / (b + gap)) * Math.floor((ah + gap) / (a + gap));
        var cw = o1 >= o2 ? a : b, chh = o1 >= o2 ? b : a, cols = Math.max(1, Math.floor((aw + gap) / (cw + gap))), rows = Math.max(1, Math.floor((ah + gap) / (chh + gap)));
        if (Math.max(o1, o2) < 1) grid(1, 1);
        else { var ox = (pw - cols * cw - (cols - 1) * gap) / 2, oy = (ph - rows * chh - (rows - 1) * gap) / 2;
          for (var r = 0; r < rows; r++) for (var q = 0; q < cols; q++) cells.push({ x: ox + q * (cw + gap), y: oy + r * (chh + gap), w: cw, h: chh, exact: true }); }
      }
      var root = $('#print-root'), html = '', urls = [];
      for (var i = 0; i < imgs.length; i += cells.length) {
        html += '<div class="pp" style="width:' + pw + 'mm;height:' + ph + 'mm">';
        cells.forEach(function (cell, j) {
          var it = imgs[i + j]; if (!it) return;
          var c = it.c; if ((c.width > c.height) !== (cell.w > cell.h) && Math.abs(cell.w - cell.h) > 1) c = rotated(c);
          var ar = c.width / c.height, w = cell.w, h = cell.w / ar; if (h > cell.h) { h = cell.h; w = cell.h * ar; }
          if (layout === 'one' && !mg) { w = cell.w; h = cell.h; } /* borderless: fill the paper */
          var u = c.toDataURL('image/jpeg', 0.95); urls.push(u);
          html += '<img src="' + u + '" style="left:' + (cell.x + (cell.w - w) / 2) + 'mm;top:' + (cell.y + (cell.h - h) / 2) + 'mm;width:' + w + 'mm;height:' + h + 'mm;' + (layout === 'one' && !mg ? 'object-fit:cover;' : '') + (marks ? 'outline:0.2mm dashed #999;' : '') + '">';
        });
        html += '</div>';
      }
      root.innerHTML = html;
      var st = $('#page-size') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'page-size' }));
      st.textContent = '@page { size: ' + pw + 'mm ' + ph + 'mm; margin: 0; }';
      return Promise.all($$('img', root).map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; }));
    }).then(function () {
      FS.busy(); document.body.classList.add('printing');
      setTimeout(function () { window.print(); }, 60);
    }).catch(function () { FS.busy(); FS.toast('ההכנה להדפסה לא הצליחה'); });
  };
  window.addEventListener('afterprint', function () { document.body.classList.remove('printing'); $('#print-root').innerHTML = ''; });
  $('#print').addEventListener('click', FS.printNow);
  $('#quick-print').addEventListener('click', function () { FS.openTab('output'); FS.printNow(); });
})();
