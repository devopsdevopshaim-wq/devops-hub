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
  var mmOf = FS.mmOf;
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
  function projectOf(list) { /* async: blob photos become data URLs so the file stands alone */
    var frames = {};
    list.forEach(function (p) { var f = p.doc.frame; if (f && f.kind === 'png' && FS.USER_FRAMES[f.id]) { var u = FS.USER_FRAMES[f.id]; frames[f.id] = { name: u.name, src: u.src, hole: u.hole, solid: u.solid }; } });
    return Promise.all(list.map(function (p) {
      return Promise.all([FS.toDataURL(p.src), p.origSrc ? FS.toDataURL(p.origSrc) : null]).then(function (r) { return { name: p.name, src: r[0], origSrc: r[1] || undefined, copies: p.copies || 1, doc: p.doc }; });
    })).then(function (photos) { return { app: 'frame-studio', v: 2, savedAt: new Date().toISOString(), frames: frames, photos: photos }; });
  }
  FS.projectOf = projectOf;
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
      proj.photos.forEach(function (ph) { var p = { id: FS.uid(), name: ph.name, src: ph.src, doc: ph.doc, undo: [], redo: [], cache: {}, copies: ph.copies || 1 }; if (ph.origSrc) { p.origSrc = ph.origSrc; FS.loadImg(ph.origSrc).catch(function () {}); } S.photos.push(p); FS.snap(p); });
      FS.busy(); FS.buildStrip(); FS.select(first); FS.toast('✔ הפרויקט נפתח');
    }).catch(function () { FS.busy(); FS.toast('הפרויקט לא נפתח'); });
  };
  $('#save-project').addEventListener('click', function () {
    if (!need()) return; FS.busy('אורז את הפרויקט…');
    projectOf(S.photos).then(function (proj) {
      FS.busy(); download(new Blob([JSON.stringify(proj)], { type: 'application/json' }), 'פרויקט ' + new Date().toISOString().slice(0, 10) + '.fstudio.json');
      FS.savedOnce = true; FS.toast('✔ קובץ הפרויקט נשמר. פותחים אותו ב"פתיחת פרויקט" וממשיכים לערוך.');
    }).catch(function () { FS.busy(); FS.toast('השמירה לא הצליחה'); });
  });
  $('#open-project').addEventListener('click', function () { $('#file-project').click(); });
  $('#file-project').addEventListener('change', function () {
    var f = this.files[0]; this.value = ''; if (!f) return;
    f.text().then(function (t) { return FS.openProject(JSON.parse(t)); }).catch(function () { FS.toast('הקובץ לא נקרא'); });
  });
  $('#save-design').addEventListener('click', function () {
    if (!need()) return; var p = FS.cur(), name = prompt('שם לעיצוב:', p.name); if (name == null) return;
    var th = FS.thumbOf(p, 260).toDataURL('image/jpeg', 0.8);
    projectOf([p]).then(function (proj) { return FS.store.put('designs', { id: 'd' + FS.uid(), name: name || p.name, at: Date.now(), thumb: th, project: proj }); })
      .then(function () { FS.savedOnce = true; FS.toast('✔ נשמר ב"העיצובים שלי"'); }).catch(function () { FS.toast('אין מקום בדפדפן. שומרים קובץ פרויקט במקום.', 5000); });
  });
  $('#my-designs-btn').addEventListener('click', showDesigns);
  function showDesigns() {
    FS.store.all('designs').then(function (list) {
      list = (list || []).filter(function (d) { return !d.lib; }).sort(function (a, b) { return b.at - a.at; });
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
  /* ---------- print: plan the sheets, show them, then print ---------- */
  function paperOf(id) { return PAPERS.filter(function (p) { return p[0] === id; })[0] || PAPERS[0]; }
  function jobFromPanel() {
    var list = $('#print-all').checked ? S.photos.slice() : FS.marked().length > 1 ? FS.marked() : FS.cur() ? [FS.cur()] : [];
    if ($('#print-ok').checked) list = list.filter(function (p) { return !p.quality || p.quality.ok; });
    return { list: list, paper: $('#paper').value, layout: $('#layout').value, margin: Number($('#margin').value), copies: FS.clamp(Number($('#copies').value) || 1, 1, 50), marks: $('#print-marks').checked, gap: Number($('#gap') ? $('#gap').value : 2) };
  }
  /* the cells of one page for one item size (mm), by layout */
  function cellsFor(layout, pw, ph, mg, gap, mm) {
    var cells = [];
    function grid(cols, rows) { var cw = (pw - mg * 2 - gap * (cols - 1)) / cols, chh = (ph - mg * 2 - gap * (rows - 1)) / rows; for (var r = 0; r < rows; r++) for (var q = 0; q < cols; q++) cells.push({ x: mg + q * (cw + gap), y: mg + r * (chh + gap), w: cw, h: chh }); }
    if (layout === 'one' || layout === '1') grid(1, 1);
    else if (layout === '2') { if (ph >= pw) grid(1, 2); else grid(2, 1); }
    else if (layout === '4') grid(2, 2);
    else if (layout === '6') { if (ph >= pw) grid(2, 3); else grid(3, 2); }
    else if (layout === '9') grid(3, 3);
    else { /* as many as fit at true size, in the better orientation */
      var a = Math.min(mm[0], mm[1]), b = Math.max(mm[0], mm[1]), aw = pw - mg * 2, ah = ph - mg * 2;
      var c1 = Math.floor((aw + gap) / (a + gap)), r1 = Math.floor((ah + gap) / (b + gap)), c2 = Math.floor((aw + gap) / (b + gap)), r2 = Math.floor((ah + gap) / (a + gap));
      var useA = c1 * r1 >= c2 * r2, cols = useA ? c1 : c2, rows = useA ? r1 : r2, cw = useA ? a : b, chh = useA ? b : a;
      if (cols * rows < 1) grid(1, 1);
      else { var ox = (pw - cols * cw - (cols - 1) * gap) / 2, oy = (ph - rows * chh - (rows - 1) * gap) / 2;
        for (var r = 0; r < rows; r++) for (var q = 0; q < cols; q++) cells.push({ x: ox + q * (cw + gap), y: oy + r * (chh + gap), w: cw, h: chh, exact: true }); }
    }
    return cells;
  }
  /* pages: [[{p, x, y, w, h, rot}]] in mm; items of the same size share sheets */
  FS.planPrint = function (job) {
    var paper = paperOf(job.paper), pw = paper[2], ph = paper[3], mg = job.margin || 0, gap = job.layout === 'fill' ? (job.gap != null ? job.gap : 2) : (mg ? 2 : 0);
    var groups = {}, order = [];
    job.list.forEach(function (p) { var mm = mmOf(p.doc), key = job.layout === 'fill' ? mm.map(function (v) { return v.toFixed(1); }).join('x') : 'all'; if (!groups[key]) { groups[key] = { mm: mm, items: [] }; order.push(key); }
      var n = (job.copies || 1) * (p.copies || 1); for (var i = 0; i < n; i++) groups[key].items.push(p); });
    var pages = [], total = 0;
    order.forEach(function (key) {
      var g = groups[key], cells = cellsFor(job.layout, pw, ph, mg, gap, g.mm);
      for (var i = 0; i < g.items.length; i += cells.length) {
        var page = [];
        cells.forEach(function (cell, j) {
          var p = g.items[i + j]; if (!p) return; var mm = mmOf(p.doc), rot = (mm[0] > mm[1]) !== (cell.w > cell.h) && Math.abs(cell.w - cell.h) > 1;
          var iw = rot ? mm[1] : mm[0], ih = rot ? mm[0] : mm[1], ar = iw / ih, w, h;
          if (cell.exact) { w = iw; h = ih; } else if ((job.layout === 'one' || job.layout === '1') && !mg) { w = cell.w; h = cell.h; } else { w = cell.w; h = cell.w / ar; if (h > cell.h) { h = cell.h; w = cell.h * ar; } }
          page.push({ p: p, x: cell.x + (cell.w - w) / 2, y: cell.y + (cell.h - h) / 2, w: w, h: h, rot: rot, cover: (job.layout === 'one' || job.layout === '1') && !mg });
          total++;
        });
        pages.push(page);
      }
    });
    return { paper: paper, pages: pages, total: total, marks: job.marks };
  };
  /* draw a plan page on a canvas (the preview) */
  function drawPage(plan, page, pxPerMm) {
    var c = FS.canvas(plan.paper[2] * pxPerMm, plan.paper[3] * pxPerMm), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    page.forEach(function (it) {
      var t = it.p._pt || (it.p._pt = FS.thumbOf(it.p, 360));
      x.save(); x.translate((it.x + it.w / 2) * pxPerMm, (it.y + it.h / 2) * pxPerMm); if (it.rot) x.rotate(Math.PI / 2);
      var w = (it.rot ? it.h : it.w) * pxPerMm, h = (it.rot ? it.w : it.h) * pxPerMm; x.drawImage(t, -w / 2, -h / 2, w, h); x.restore();
      if (plan.marks) { x.strokeStyle = '#9aa'; x.setLineDash([3, 3]); x.strokeRect(it.x * pxPerMm, it.y * pxPerMm, it.w * pxPerMm, it.h * pxPerMm); x.setLineDash([]); }
    });
    return c;
  }
  FS.doPrint = function (plan) {
    FS.busy('מכין להדפסה…');
    return ready().then(function () {
      var cache = {}, root = $('#print-root'), html = '', pw = plan.paper[2], ph = plan.paper[3];
      plan.pages.forEach(function (page) {
        html += '<div class="pp" style="width:' + pw + 'mm;height:' + ph + 'mm">';
        page.forEach(function (it) {
          var key = it.p.id + (it.rot ? 'r' : '');
          if (!cache[key]) { var k = Math.min(1, 3600 / Math.max(it.p.doc.w, it.p.doc.h)), c = FS.renderFull(it.p, k, false); if (it.rot) c = rotated(c); cache[key] = URL.createObjectURL(dataBlob(c.toDataURL('image/jpeg', 0.95))); }
          html += '<img src="' + cache[key] + '" style="left:' + it.x + 'mm;top:' + it.y + 'mm;width:' + it.w + 'mm;height:' + it.h + 'mm;' + (it.cover ? 'object-fit:cover;' : '') + (plan.marks ? 'outline:0.2mm dashed #999;' : '') + '">';
        });
        html += '</div>';
      });
      root.innerHTML = html;
      var st = $('#page-size') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'page-size' }));
      st.textContent = '@page { size: ' + pw + 'mm ' + ph + 'mm; margin: 0; }';
      FS.emit('printed', plan.total);
      return Promise.all($$('img', root).map(function (im) { return im.decode ? im.decode().catch(function () {}) : null; }));
    }).then(function () { FS.busy(); document.body.classList.add('printing'); setTimeout(function () { window.print(); }, 60); })
      .catch(function () { FS.busy(); FS.toast('ההכנה להדפסה לא הצליחה'); });
  };
  /* the station prints straight away; the buttons open the layout preview first */
  FS.printNow = function (job) {
    if (job) { var plan = FS.planPrint(job); if (!plan.total) return; return FS.doPrint(plan); }
    if (!need()) return; FS.printPreview();
  };
  FS.printPreview = function () {
    var job = jobFromPanel(); if (!job.list.length) { FS.toast('אין תמונות להדפסה'); return; }
    var body = FS.dialog('🖨️ תכנון הדפסה ופריסה', '<div class="pv-wrap"><div class="pv-side">' +
      '<div class="row2"><div class="field"><label>נייר</label><select id="pv-paper">' + $('#paper').innerHTML + '</select></div><div class="field"><label>סידור</label><select id="pv-layout">' + $('#layout').innerHTML + '</select></div></div>' +
      '<div class="row2"><div class="field"><label>שוליים</label><select id="pv-margin">' + $('#margin').innerHTML + '</select></div><div class="field"><label>רווח בין מגנטים (מ״מ)</label><input type="number" id="pv-gap" min="0" max="20" step="0.5" value="2"></div></div>' +
      '<label class="check"><input type="checkbox" id="pv-marks"' + ($('#print-marks').checked ? ' checked' : '') + '> קווי חיתוך</label>' +
      '<div class="pv-sum" id="pv-sum"></div><h3>התמונות בהדפסה</h3><div class="pv-table" id="pv-table"></div></div>' +
      '<div class="pv-pages" id="pv-pages"></div></div><div class="pv-foot"><button class="btn" id="pv-back">חזרה לעריכה</button><button class="btn primary big" id="pv-print">🖨️ הדפסה</button></div>', true);
    $('#pv-paper', body).value = $('#paper').value; $('#pv-layout', body).value = job.layout === 'one' ? 'fill' : job.layout; $('#pv-margin', body).value = String(job.margin);
    var frames = '<option value="">בלי מסגרת</option>' + FS.GEN_FRAMES.map(function (f) { return '<option value="g:' + f.id + '">' + f.name + '</option>'; }).join('') + Object.keys(FS.USER_FRAMES).map(function (id) { return '<option value="u:' + id + '">' + FS.esc(FS.USER_FRAMES[id].name) + '</option>'; }).join('');
    var sizes = FS.FORMATS.filter(function (f) { return f.id !== 'orig'; }).map(function (f) { return '<option value="' + f.id + '">' + f.name + '</option>'; }).join('');
    var on = {}; job.list.forEach(function (p) { on[p.id] = true; });
    var all = $('#print-all').checked ? S.photos.slice() : S.photos.filter(function (p) { return on[p.id]; });
    function frameVal(p) { var f = p.doc.frame; return !f ? '' : f.kind === 'png' ? 'u:' + f.id : 'g:' + f.id; }
    function table() {
      $('#pv-table', body).innerHTML = all.map(function (p) {
        var t = (p._pt || (p._pt = FS.thumbOf(p, 360))).toDataURL('image/jpeg', 0.6), fmtOpts = sizes + (FS.fmt(p.doc.fmt) && p.doc.fmt !== 'orig' ? '' : '<option value="' + p.doc.fmt + '">' + (mmOf(p.doc)[0] / 10).toFixed(1) + '×' + (mmOf(p.doc)[1] / 10).toFixed(1) + ' ס״מ</option>');
        return '<div class="pv-row" data-id="' + p.id + '"><input type="checkbox" class="pv-on"' + (on[p.id] ? ' checked' : '') + ' title="בהדפסה"><img src="' + t + '" alt=""><div class="pv-f"><b>' + FS.esc(p.name) + '</b>' +
          '<select class="pv-frame" title="מסגרת">' + frames + '</select><select class="pv-size" title="גודל">' + fmtOpts + '</select></div><label class="pv-c">×<input type="number" class="pv-copies" min="1" max="999" value="' + (p.copies || 1) + '"></label></div>';
      }).join('');
      $$('.pv-row', body).forEach(function (row) {
        var p = S.photos.filter(function (x) { return x.id === row.dataset.id; })[0];
        $('.pv-frame', row).value = frameVal(p); $('.pv-size', row).value = p.doc.fmt;
        $('.pv-on', row).addEventListener('change', function () { if (this.checked) on[p.id] = true; else delete on[p.id]; plan(); });
        $('.pv-copies', row).addEventListener('change', function () { p.copies = FS.clamp(Number(this.value) || 1, 1, 999); plan(); });
        $('.pv-frame', row).addEventListener('change', function () { var v = this.value; FS.setFrame(p, !v ? null : v[0] === 'u' ? { kind: 'png', id: v.slice(2), opacity: 1, tint: '#d4a843', tintAmt: 0, clip: false } : { kind: 'gen', id: v.slice(2), opacity: 1, thick: 1 }, { quiet: true }); p.cache = {}; p._pt = null; FS.snap(p); table(); plan(); });
        $('.pv-size', row).addEventListener('change', function () { var mm = mmOf(p.doc); FS.applyFormat(p.doc, this.value, FS.img(p.src), mm[0], mm[1]); if (p.doc.frame) FS.setFrame(p, p.doc.frame, { quiet: true, noTexts: true }); p.cache = {}; p._pt = null; FS.snap(p); table(); plan(); });
      });
    }
    var current = null;
    function plan() {
      var j = { list: all.filter(function (p) { return on[p.id]; }), paper: $('#pv-paper', body).value, layout: $('#pv-layout', body).value, margin: Number($('#pv-margin', body).value), gap: Number($('#pv-gap', body).value), copies: job.copies, marks: $('#pv-marks', body).checked };
      current = FS.planPrint(j);
      var box = $('#pv-pages', body); box.innerHTML = '';
      var k = Math.min(3, 520 / current.paper[3]);
      current.pages.slice(0, 40).forEach(function (pg, i) { var f = document.createElement('figure'); f.appendChild(drawPage(current, pg, k)); var cap = document.createElement('figcaption'); cap.textContent = 'דף ' + (i + 1) + ' · ' + pg.length + ' פריטים'; f.appendChild(cap); box.appendChild(f); });
      if (current.pages.length > 40) box.insertAdjacentHTML('beforeend', '<p class="hint">ועוד ' + (current.pages.length - 40) + ' דפים…</p>');
      var used = 0; current.pages.forEach(function (pg) { pg.forEach(function (it) { used += it.w * it.h; }); });
      var eff = current.pages.length ? Math.round(used / (current.pages.length * current.paper[2] * current.paper[3]) * 100) : 0;
      $('#pv-sum', body).innerHTML = '<div><b>' + current.total + '</b><small>פריטים</small></div><div><b>' + current.pages.length + '</b><small>דפים</small></div><div><b>' + (current.pages[0] ? current.pages[0].length : 0) + '</b><small>בדף</small></div><div><b>' + eff + '%</b><small>ניצול נייר</small></div>';
      $('#pv-print', body).disabled = !current.total;
    }
    ['#pv-paper', '#pv-layout', '#pv-margin', '#pv-gap', '#pv-marks'].forEach(function (s) { $(s, body).addEventListener('change', plan); });
    $('#pv-back', body).addEventListener('click', function () { FS.closeDialog(); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); });
    $('#pv-print', body).addEventListener('click', function () { var pl = current; $('#paper').value = $('#pv-paper', body).value; $('#layout').value = $('#pv-layout', body).value; FS.closeDialog(); FS.emit('doc'); FS.refreshStrip && FS.refreshStrip(); FS.doPrint(pl); });
    table(); plan();
  };
  window.addEventListener('afterprint', function () { document.body.classList.remove('printing'); $('#print-root').innerHTML = ''; });
  $('#print').addEventListener('click', function () { FS.printNow(); });
  $('#quick-print').addEventListener('click', function () { FS.openTab('output'); FS.printNow(); });
})();
