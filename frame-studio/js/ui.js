/* The editor screen: tabs, photo strip, the canvas (drag, pinch, wheel, handles), the panels and their controls. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;
  var view = $('#view'), vctx = view.getContext('2d'), wrap = $('#wrap');

  /* ---------- helpers shared with the other files ---------- */
  FS.busy = function (msg) { var b = $('#busy'); if (msg) { $('#busy-msg').textContent = msg; b.hidden = false; } else b.hidden = true; };
  FS.dialog = function (title, html, wide) {
    var d = $('#dlg'); $('#dlg-title').textContent = title; var body = $('#dlg-body'); body.innerHTML = html || '';
    d.classList.toggle('wide', !!wide); if (!d.open) d.showModal(); return body;
  };
  FS.closeDialog = function () { var d = $('#dlg'); if (d.open) d.close(); };
  $('#dlg').addEventListener('close', function () { FS.emit('dialog-closed'); if (!$('#dlg').open) $('#dlg-body').innerHTML = ''; });
  FS.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- render ---------- */
  var pending = false, fastUntil = 0, idleT = null;
  FS.render = function (fast) {
    if (fast) { fastUntil = Date.now() + 220; clearTimeout(idleT); idleT = setTimeout(function () { FS.render(); }, 260); }
    if (pending) return; pending = true;
    requestAnimationFrame(function () { pending = false; paint(); });
  };
  FS.viewScale = 1;
  var orig = $('#view-orig'), octx = orig.getContext('2d');
  S.view = FS.prefs.view || 'single'; S.zoom = 1;
  function paint() {
    var p = FS.cur();
    $('#welcome').hidden = !!p; view.hidden = !p; orig.hidden = !p || S.view !== 'split';
    wrap.classList.toggle('split', !!p && S.view === 'split'); wrap.classList.toggle('zoomed', S.zoom > 1.01);
    if (!p) { $('#stage-info').textContent = ''; return; }
    var d = p.doc, box = wrap.getBoundingClientRect(), pad = 28, split = S.view === 'split', bw = split ? (box.width - pad * 1.5) / 2 : box.width - pad;
    var sc = Math.min(bw / d.w, (box.height - pad - 24) / d.h); if (!(sc > 0)) sc = 0.2;
    sc *= S.zoom;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.round(d.w * sc * dpr), ch = Math.round(d.h * sc * dpr);
    if (view.width !== cw || view.height !== ch) { view.width = cw; view.height = ch; }
    view.style.width = Math.round(d.w * sc) + 'px'; view.style.height = Math.round(d.h * sc) + 'px';
    FS.viewScale = sc;
    var fast = Date.now() < fastUntil, max = Math.min(2400, Math.max(700, Math.round(Math.max(d.w, d.h) * sc * dpr * 1.3)));
    FS.draw(vctx, p, { scale: sc * dpr, max: fast ? Math.min(max, 900) : max, fast: fast, sel: S.sel });
    if (split) { /* the untouched photo, same size box, on the left */
      var im = FS.img(p.origSrc || p.src), k = Math.min(d.w * sc / im.naturalWidth, d.h * sc / im.naturalHeight);
      var ow = Math.round(im.naturalWidth * k), oh = Math.round(im.naturalHeight * k);
      if (orig.width !== Math.round(ow * dpr) || orig.height !== Math.round(oh * dpr)) { orig.width = Math.round(ow * dpr); orig.height = Math.round(oh * dpr); }
      orig.style.width = ow + 'px'; orig.style.height = oh + 'px'; octx.imageSmoothingQuality = 'high'; octx.drawImage(im, 0, 0, orig.width, orig.height);
    }
    var mm = FS.mmOf(d);
    $('#stage-info').textContent = d.w + '×' + d.h + ' px · ' + (mm[0] / 10).toFixed(1) + '×' + (mm[1] / 10).toFixed(1) + ' ס״מ · 300dpi · ' + Math.round(sc * 100 * dpr / dpr) + '%' + (p.copies > 1 ? ' · ×' + p.copies + ' עותקים' : '');
    if (!fast) histoSoon();
  }
  /* ---------- histogram ---------- */
  var histoT = null;
  function histoSoon() { clearTimeout(histoT); histoT = setTimeout(histo, 200); }
  function histo() {
    var c = $('#histo'), p = FS.cur(); if (!c || !p || $('[data-pane=adjust]').hidden) return;
    var src = FS.processed(p, 400, true); if (!src) return;
    var x = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, src.width, src.height).data, H = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)], mx = 1;
    for (var i = 0; i < x.length; i += 4) { H[0][x[i]]++; H[1][x[i + 1]]++; H[2][x[i + 2]]++; H[3][(0.299 * x[i] + 0.587 * x[i + 1] + 0.114 * x[i + 2]) | 0]++; }
    for (var v = 2; v < 254; v++) for (var k = 0; k < 4; k++) mx = Math.max(mx, H[k][v]);
    var g = c.getContext('2d'), W = c.width, Hh = c.height; g.clearRect(0, 0, W, Hh); g.globalCompositeOperation = 'lighter';
    [['rgba(255,80,80,.55)', 0], ['rgba(80,220,120,.55)', 1], ['rgba(90,140,255,.6)', 2], ['rgba(230,230,240,.35)', 3]].forEach(function (s) {
      g.fillStyle = s[0]; g.beginPath(); g.moveTo(0, Hh);
      for (var t = 0; t < 256; t++) g.lineTo(t / 255 * W, Hh - Math.min(1, H[s[1]][t] / mx) * (Hh - 2));
      g.lineTo(W, Hh); g.closePath(); g.fill();
    });
    g.globalCompositeOperation = 'source-over';
  }
  FS.histo = histo;
  /* ---------- view mode and zoom ---------- */
  function setView(v) { S.view = v; FS.prefs.view = v; FS.savePrefs(); $$('[data-view]').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); }); FS.render(); }
  $$('[data-view]').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view); }); });
  setView(S.view);
  function setZoom(z) { S.zoom = FS.clamp(z, 0.25, 8); $('#zoom-val').textContent = Math.round(S.zoom * 100) + '%'; FS.render(); }
  $('#zoom-in').addEventListener('click', function () { setZoom(S.zoom * 1.25); });
  $('#zoom-out').addEventListener('click', function () { setZoom(S.zoom / 1.25); });
  $('#zoom-fit').addEventListener('click', function () { setZoom(1); });
  window.addEventListener('resize', function () { FS.render(); });

  FS.on('doc', function () { FS.render(); syncPanels(); refreshThumb(); });
  FS.on('history', function () { var p = FS.cur(); $('#undo').disabled = !p || p.undo.length < 2; $('#redo').disabled = !p || !p.redo.length; });
  /* a change that should be undoable */
  FS.changed = function (fast) { var p = FS.cur(); if (!p) return; FS.render(fast); if (!fast) { FS.snap(p); syncPanels(); refreshThumb(); } };
  var commitT = null;
  FS.commitSoon = function () { clearTimeout(commitT); commitT = setTimeout(function () { var p = FS.cur(); if (p) { FS.snap(p); refreshThumb(); } }, 450); };

  /* ---------- crisp line icons for the tool rail ---------- */
  var ICONS = {
    event: '<path d="M6 3v7a6 6 0 0 0 12 0V3"/><path d="M6 3h4v7a2 2 0 0 0 4 0V3h4"/><path d="M6 7h4M14 7h4"/>',
    photos: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
    adjust: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    filters: '<circle cx="9" cy="9" r="5"/><circle cx="15" cy="9" r="5"/><circle cx="12" cy="15" r="5"/>',
    frames: '<rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7" y="7" width="10" height="10"/><path d="M3 3l4 4M21 3l-4 4M3 21l4-4M21 21l-4-4"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    styles: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
    ai: '<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>',
    games: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v4M5 13h4"/><circle cx="15.5" cy="12" r="1"/><circle cx="18" cy="14.5" r="1"/>',
    output: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>'
  };
  $$('.tools [role=tab]').forEach(function (b, i) {
    var ic = ICONS[b.dataset.tab]; if (!ic) return; var sp = b.querySelector('span');
    if (sp) sp.outerHTML = '<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ic + '</svg>';
    b.style.setProperty('--i', i);
  });
  /* a soft ripple where a button is pressed */
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.btn, .tools button, .tile, .ai-style, .game, .seg button'); if (!b || b.disabled) return;
    var r = b.getBoundingClientRect(), s = document.createElement('i'); s.className = 'ripple'; var d = Math.max(r.width, r.height) * 2;
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(s); setTimeout(function () { s.remove(); }, 600);
  });

  /* ---------- tabs ---------- */
  function openTab(name) {
    $$('.tools [role=tab]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false'); });
    $$('[data-pane]').forEach(function (s) { var show = s.dataset.pane === name; if (show && s.hidden) { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); } s.hidden = !show; });
    FS.prefs.tab = name; FS.savePrefs();
    if (name === 'filters') buildPresets();
    if (name === 'frames') buildFrames();
    if (name === 'text') syncLayers();
    if (name === 'styles' && FS.buildStyles) FS.buildStyles();
    if (name === 'adjust' && FS.histo) setTimeout(FS.histo, 50);
  }
  FS.openTab = openTab;
  $$('.tools [role=tab]').forEach(function (b) { b.addEventListener('click', function () { openTab(b.dataset.tab); }); });

  /* ---------- formats ---------- */
  /* the owner's own sizes (in mm), kept in this browser: they show in every size menu */
  /* the owner's own sizes, 3 to 5 of them (in mm), kept in this browser: they are the only sizes the studio offers */
  var MAX_SIZES = 5, DEF_SIZES = [{ id: 's1', name: 'מגנט 5×7.5', w: 50, h: 75 }, { id: 's2', name: 'מגנט לרוחב 7.5×5', w: 75, h: 50 }, { id: 's3', name: 'תמונה 10×15', w: 100, h: 150 }];
  if (!Array.isArray(FS.prefs.sizes) || !FS.prefs.sizes.length) { FS.prefs.sizes = DEF_SIZES.slice(); FS.savePrefs(); }
  FS.MAX_SIZES = MAX_SIZES;
  FS.mySizes = function () { return Array.isArray(FS.prefs.sizes) ? FS.prefs.sizes.slice(0, MAX_SIZES) : []; };
  FS.saveSize = function (name, wmm, hmm) {
    var l = FS.mySizes().filter(function (z) { return !(z.w === wmm && z.h === hmm); });
    if (l.length >= MAX_SIZES) { FS.toast('אפשר עד ' + MAX_SIZES + ' גדלים. מוחקים אחד ב"ניהול הגדלים".', 5000); return null; }
    var z = { id: 's' + FS.uid(), name: String(name || '').slice(0, 30) || (wmm / 10) + '×' + (hmm / 10), w: wmm, h: hmm }; l.push(z);
    FS.prefs.sizes = l; FS.savePrefs(); FS.emit('sizes'); return z;
  };
  FS.delSize = function (id) { FS.prefs.sizes = FS.mySizes().filter(function (z) { return z.id !== id; }); FS.savePrefs(); FS.emit('sizes'); };
  FS.sizeLabel = function (z) { var d = (z.w / 10) + '×' + (z.h / 10); return z.name.indexOf(d) >= 0 ? z.name + ' ס״מ' : z.name + ' (' + d + ' ס״מ)'; };
  FS.sizeOf = function (v) { if (!/^my:/.test(v)) return null; return FS.mySizes().filter(function (z) { return 'my:' + z.id === v; })[0] || null; };
  /* which of my sizes a page is (by its true size), for the menus */
  FS.sizeOfDoc = function (d) { var mm = FS.mmOf(d); return FS.mySizes().filter(function (z) { return Math.abs(z.w - mm[0]) < 0.6 && Math.abs(z.h - mm[1]) < 0.6; })[0] || null; };
  function fillFormats(sel) { sel.innerHTML = FS.mySizes().map(function (z) { return '<option value="my:' + z.id + '">' + FS.esc(FS.sizeLabel(z)) + '</option>'; }).join(''); }
  function syncFmt() {
    var p = FS.cur(), sel = $('#fmt'); if (!p) return;
    var z = FS.sizeOfDoc(p.doc); if (z) { sel.value = 'my:' + z.id; return; }
    var mm = FS.mmOf(p.doc), o = $('#fmt-cur', sel) || sel.appendChild(Object.assign(document.createElement('option'), { id: 'fmt-cur' }));
    o.value = 'cur'; o.textContent = 'נוכחי: ' + (mm[0] / 10).toFixed(1) + '×' + (mm[1] / 10).toFixed(1) + ' ס״מ'; sel.value = 'cur';
  }
  FS.syncFmt = syncFmt;
  function fillAll() {
    var b = $('#fmt-new').value;
    fillFormats($('#fmt')); fillFormats($('#fmt-new'));
    $('#fmt').insertAdjacentHTML('beforeend', '<option value="manage">⚙️ ניהול הגדלים שלי…</option>');
    if (b && FS.sizeOf(b)) $('#fmt-new').value = b;
    syncFmt();
  }
  fillAll(); FS.on('sizes', fillAll); FS.on('doc', syncFmt);
  if (!FS.sizeOf(FS.prefs.fmt || '')) { FS.prefs.fmt = 'my:' + FS.mySizes()[0].id; FS.savePrefs(); }
  $('#fmt-new').value = FS.prefs.fmt;
  $('#fmt-new').addEventListener('change', function () { FS.prefs.fmt = this.value; FS.savePrefs(); });
  /* the sizes manager: name, width and height in cm, up to five */
  FS.manageSizes = function () {
    var list = FS.mySizes().map(function (z) { return Object.assign({}, z); });
    var body = FS.dialog('📐 הגדלים שלי', '<p class="hint">מגדירים 3 עד 5 גדלים שעובדים איתם. רק הם יופיעו בכל התפריטים, ונשמרים בתוכנה.</p><div id="sz-rows"></div><button class="btn wide" id="sz-add">＋ גודל</button><button class="btn primary wide" id="sz-save">💾 שמירה</button>');
    function rows() {
      $('#sz-rows', body).innerHTML = list.map(function (z, i) { return '<div class="sz-row" data-i="' + i + '"><input class="sz-n" maxlength="30" value="' + FS.esc(z.name) + '" placeholder="שם"><label>רוחב<input class="sz-w" type="number" min="1" max="100" step="0.1" value="' + (z.w / 10) + '"></label><label>גובה<input class="sz-h" type="number" min="1" max="100" step="0.1" value="' + (z.h / 10) + '"></label><button class="btn small danger sz-del" title="מחיקה">🗑</button></div>'; }).join('');
      $$('.sz-row', body).forEach(function (r) {
        var z = list[Number(r.dataset.i)];
        $('.sz-n', r).addEventListener('input', function () { z.name = this.value; });
        $('.sz-w', r).addEventListener('input', function () { z.w = Math.round(Number(this.value) * 10); });
        $('.sz-h', r).addEventListener('input', function () { z.h = Math.round(Number(this.value) * 10); });
        $('.sz-del', r).addEventListener('click', function () { if (list.length <= 1) return FS.toast('צריך לפחות גודל אחד'); list.splice(Number(r.dataset.i), 1); rows(); });
      });
      $('#sz-add', body).disabled = list.length >= MAX_SIZES;
    }
    $('#sz-add', body).addEventListener('click', function () { if (list.length >= MAX_SIZES) return; list.push({ id: 's' + FS.uid(), name: 'גודל חדש', w: 60, h: 90 }); rows(); });
    $('#sz-save', body).addEventListener('click', function () {
      var ok = list.filter(function (z) { return z.w > 9 && z.h > 9 && z.w <= 1000 && z.h <= 1000; });
      if (!ok.length) return FS.toast('רוחב וגובה בס״מ');
      ok.forEach(function (z) { z.name = String(z.name || '').trim().slice(0, 30) || (z.w / 10) + '×' + (z.h / 10); });
      FS.prefs.sizes = ok.slice(0, MAX_SIZES); FS.savePrefs(); FS.emit('sizes'); FS.closeDialog(); FS.toast('✔ ' + ok.length + ' גדלים נשמרו');
    });
    rows();
  };
  function setFormat(id, w, h) {
    FS.targets().forEach(function (p) {
      var d = p.doc, oldW = d.w, oldH = d.h, ref = d.frame;
      FS.applyFormat(d, id, FS.img(p.src), w, h);
      d.layers.forEach(function (L) { L.x = L.x / oldW * d.w; L.y = L.y / oldH * d.h; });
      if (ref) FS.fitPhoto(d, FS.img(p.src));
      if (p !== FS.cur()) { p.cache = {}; FS.snap(p); }
    });
    FS.targets().forEach(function (p) { if (FS.applyCredit) FS.applyCredit(p); });
    FS.changed(); if (FS.targets().length > 1) FS.refreshStrip();
  }
  FS.setFormat = setFormat;
  $('#fmt').addEventListener('change', function () {
    var v = this.value;
    if (v === 'manage') { syncFmt(); FS.manageSizes(); return; }
    if (!FS.cur()) return;
    var my = FS.sizeOf(v); if (my) setFormat('cm', my.w, my.h);
  });

  /* ---------- photos in ---------- */
  function addFiles(files) {
    files = Array.prototype.filter.call(files || [], function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(f.name); });
    if (!files.length) return;
    FS.busy('טוען ' + files.length + ' תמונות…');
    var first = S.photos.length, chain = Promise.resolve(), bad = 0;
    files.forEach(function (f) { chain = chain.then(function () { return FS.addPhotoFile(f).catch(function () { bad++; }); }); });
    chain.then(function () {
      FS.busy();
      if (bad) FS.toast(bad + ' קבצים לא נפתחו. HEIC נפתח רק בספארי; אפשר לשמור כ־JPG ולנסות שוב.', 5000);
      if (S.photos.length > first) select(first);
      buildStrip();
      if (S.photos.length > first) FS.emit('photos-added', { from: first, n: S.photos.length - first });
    });
  }
  FS.addFiles = addFiles;
  ['#file-photos', '#file-photos-2'].forEach(function (s) { $(s).addEventListener('change', function () { addFiles(this.files); this.value = ''; }); });
  ['dragover', 'dragenter'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); document.body.classList.add('dragging'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { document.addEventListener(ev, function (e) { if (ev === 'drop' || !e.relatedTarget) document.body.classList.remove('dragging'); }); });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    var fs = e.dataTransfer && e.dataTransfer.files; if (!fs || !fs.length) return;
    if (e.target.closest && e.target.closest('[data-pane=frames]')) FS.addFrameFiles(fs); else addFiles(fs);
  });
  document.addEventListener('paste', function (e) {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    var items = e.clipboardData && e.clipboardData.files; if (items && items.length) addFiles(items);
  });
  $('#demo').addEventListener('click', function () {
    var c = FS.canvas(1800, 1200), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 1200);
    g.addColorStop(0, '#ffb26b'); g.addColorStop(0.55, '#ff6f91'); g.addColorStop(0.56, '#2d4f8e'); g.addColorStop(1, '#0f2147');
    x.fillStyle = g; x.fillRect(0, 0, 1800, 1200);
    x.fillStyle = '#ffe9a8'; x.beginPath(); x.arc(900, 640, 170, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,233,168,.25)'; for (var i = 0; i < 14; i++) x.fillRect(900 - 260 + i * 10, 690 + i * 28, 520 - i * 20, 6);
    x.fillStyle = '#0b1530'; x.beginPath(); x.moveTo(0, 820); x.quadraticCurveTo(300, 700, 620, 830); x.lineTo(620, 1200); x.lineTo(0, 1200); x.fill();
    x.beginPath(); x.moveTo(1800, 790); x.quadraticCurveTo(1450, 680, 1180, 840); x.lineTo(1180, 1200); x.lineTo(1800, 1200); x.fill();
    c.toBlob(function (b) { b.name = 'שקיעה לדוגמה.jpg'; addFiles([new File([b], 'שקיעה לדוגמה.jpg', { type: 'image/jpeg' })]); }, 'image/jpeg', 0.92);
  });

  /* ---------- the strip ---------- */
  function thumbOf(p, size) {
    var d = p.doc, k = size / Math.max(d.w, d.h), c = FS.canvas(d.w * k, d.h * k);
    FS.draw(c.getContext('2d'), p, { scale: k, max: 400, fast: true });
    return c;
  }
  FS.thumbOf = thumbOf;
  /* ---------- the filmstrip: any number of photos, thumbnails drawn when they come into view, multi-select ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { drawTile(e.target); io.unobserve(e.target); } }); }, { root: $('#strip'), rootMargin: '300px' }) : null;
  function drawTile(b) {
    var p = S.photos[Number(b.dataset.i)]; if (!p || !FS.img(p.src)) return;
    var box = b.querySelector('.thc'), old = box.firstChild, c = thumbOf(p, 150); if (old) box.replaceChild(c, old); else box.appendChild(c);
  }
  function frameName(p) {
    var f = p.doc.frame; if (!f) return '';
    if (f.kind === 'png') return (FS.USER_FRAMES[f.id] || {}).name || 'PNG';
    return ((FS.GEN_FRAMES || []).filter(function (g) { return g.id === f.id; })[0] || {}).name || '';
  }
  function tileInfo(b, p) {
    var mm = FS.mmOf(p.doc), fr = frameName(p);
    b.querySelector('.tmeta').innerHTML = '<span>' + FS.esc(fr || 'בלי מסגרת') + '</span><span>' + (mm[0] / 10).toFixed(1) + '×' + (mm[1] / 10).toFixed(1) + '</span>' + (p.copies > 1 ? '<b>×' + p.copies + '</b>' : '') + (p.doc.photo.style ? '<span>🎨</span>' : '') + (p.origSrc ? '<span>🤖</span>' : '');
  }
  var lastClick = -1;
  function buildStrip() {
    var st = $('#strip'); st.innerHTML = '';
    var frag = document.createDocumentFragment(), only = S.onlyMarked && FS.marked().length;
    S.photos.forEach(function (p, i) {
      if (only && !S.marked[p.id] && i !== S.cur) return;
      var b = document.createElement('div'); b.className = 'th' + (i === S.cur ? ' on' : '') + (S.marked[p.id] ? ' marked' : ''); b.title = p.name; b.dataset.i = i; b.tabIndex = 0;
      b.innerHTML = '<label class="mk" title="סימון"><input type="checkbox"' + (S.marked[p.id] ? ' checked' : '') + '></label><div class="thc"></div><div class="tmeta"></div><span class="tn">' + (i + 1) + '</span><span class="x" title="הסרה">✕</span>';
      tileInfo(b, p);
      b.querySelector('input').addEventListener('click', function (e) { e.stopPropagation(); toggleMark(i, e.shiftKey); });
      b.querySelector('.x').addEventListener('click', function (e) { e.stopPropagation(); removePhoto(i); });
      b.addEventListener('click', function (e) { if (e.ctrlKey || e.metaKey) toggleMark(i); else if (e.shiftKey) toggleMark(i, true); else select(i); });
      frag.appendChild(b);
      if (io) io.observe(b); else drawTile(b);
    });
    st.appendChild(frag);
    if (FS.markStrip) FS.markStrip();
    if (S.photos.length) { var add = document.createElement('label'); add.className = 'th add'; add.innerHTML = '<span>＋</span><small>עוד תמונות</small><input type="file" accept="image/*" multiple hidden>'; add.querySelector('input').addEventListener('change', function () { addFiles(this.files); }); st.appendChild(add); }
    markBar();
  }
  FS.buildStrip = buildStrip;
  FS.refreshStrip = function () { $$('#strip .th[data-i]').forEach(function (b) { var p = S.photos[Number(b.dataset.i)]; if (p) { tileInfo(b, p); if (b.querySelector('canvas')) drawTile(b); } }); if (FS.markStrip) FS.markStrip(); markBar(); };
  function toggleMark(i, range) {
    if (range && lastClick > -1) { var a = Math.min(lastClick, i), z = Math.max(lastClick, i); for (var k = a; k <= z; k++) S.marked[S.photos[k].id] = true; }
    else { var id = S.photos[i].id; if (S.marked[id]) delete S.marked[id]; else S.marked[id] = true; }
    lastClick = i;
    var c = FS.cur(); if (S.marked[S.photos[i].id] && (!c || !S.marked[c.id])) { select(i); }   /* the photo on screen is always one of the marked, so edits reach them all */
    else if (c && !S.marked[c.id]) { var m0 = FS.marked()[0]; if (m0) select(S.photos.indexOf(m0)); }
    $$('#strip .th[data-i]').forEach(function (b) { var p = S.photos[Number(b.dataset.i)]; var on = !!S.marked[p.id]; b.classList.toggle('marked', on); b.querySelector('input').checked = on; });
    markBar();
  }
  function markBar() {
    var n = FS.marked().length, tot = S.photos.length;
    $('#mark-count').textContent = n ? n + ' מסומנות מתוך ' + tot : tot + ' תמונות';
    var grid = FS.gridMode && FS.gridMode();
    $('#stripbar').hidden = !tot || grid;
    var banner = $('#batch-banner'); banner.hidden = grid || !(S.batch !== false && n > 1);
    banner.querySelector('b').textContent = n;
    $('#batch-toggle').classList.toggle('on', S.batch !== false && n > 1);
    $('#batch-toggle').disabled = n < 2;
  }
  FS.markBar = markBar;
  $('#mark-all').addEventListener('click', function () { S.photos.forEach(function (p) { S.marked[p.id] = true; }); buildStrip(); });
  $('#mark-none').addEventListener('click', function () { S.marked = {}; S.batch = undefined; buildStrip(); });
  $('#mark-inv').addEventListener('click', function () { S.photos.forEach(function (p) { if (S.marked[p.id]) delete S.marked[p.id]; else S.marked[p.id] = true; }); buildStrip(); });
  $('#mark-bad').addEventListener('click', function () { S.marked = {}; S.photos.forEach(function (p) { if (p.quality && !p.quality.ok) S.marked[p.id] = true; }); buildStrip(); FS.toast(FS.marked().length ? 'סומנו ' + FS.marked().length + ' תמונות שלא עברו בדיקה' : 'אין תמונות פסולות (או שעוד לא נבדקו)'); });
  $('#batch-toggle').addEventListener('click', function () {
    S.batch = S.batch === false; var c = FS.cur();
    if (S.batch && c && !S.marked[c.id]) { var m = FS.marked(); if (m.length) select(S.photos.indexOf(m[0])); }
    markBar(); FS.toast(S.batch ? '✏️ עריכה מרובה: כל שינוי חל על ' + FS.marked().length + ' התמונות המסומנות' : 'עריכה מרובה כבויה: שינויים חלים רק על התמונה שעל המסך');
  });
  $('#mark-del').addEventListener('click', function () {
    var m = FS.marked(); if (!m.length) return; if (!confirm('להסיר ' + m.length + ' תמונות מהפרויקט?')) return;
    S.photos = S.photos.filter(function (p) { return !S.marked[p.id]; }); m.forEach(function (p) { if (/^blob:/.test(p.src)) setTimeout(function () { URL.revokeObjectURL(p.src); }, 5000); });
    S.marked = {}; S.batch = undefined; S.cur = Math.min(S.cur, S.photos.length - 1); S.sel = null; buildStrip(); FS.emit('doc'); FS.emit('history');
  });
  $('#mark-copies-go').addEventListener('click', function () {
    var n = FS.clamp(Number($('#mark-copies').value) || 1, 1, 999), list = FS.marked().length ? FS.marked() : FS.cur() ? [FS.cur()] : [];
    list.forEach(function (p) { p.copies = n; }); FS.refreshStrip(); FS.render(); FS.toast('×' + n + ' עותקים ל־' + list.length + ' תמונות');
  });
  /* in batch mode: copy what changed on the current photo to every marked one */
  FS.batch = function (fn) { var c = FS.cur(); FS.targets().forEach(function (q) { if (q !== c) { fn(q, c); q.cache = {}; FS.snap(q); } }); if (FS.targets().length > 1) FS.refreshStrip(); };
  var thumbT = null;
  function refreshThumb() {
    clearTimeout(thumbT);
    thumbT = setTimeout(function () { var b = $('#strip .th[data-i="' + S.cur + '"]'), p = FS.cur(); if (b && p) { drawTile(b); tileInfo(b, p); } }, 300);
  }
  function removePhoto(i) {
    var p = S.photos[i]; S.photos.splice(i, 1); delete S.marked[p.id];
    if (S.cur >= S.photos.length) S.cur = S.photos.length - 1;
    S.sel = null; buildStrip(); FS.emit('doc'); FS.emit('history');
  }
  FS.select = function (i) { select(i); };
  function select(i) {
    var prev = FS.cur(); if (prev && prev !== S.photos[i]) prev.cache = {}; /* only the photo on screen keeps its big preview in memory */
    S.cur = i; S.sel = null; lastClick = i;
    view.classList.remove('swap'); void view.offsetWidth; view.classList.add('swap');
    var p = FS.cur(); if (p && !p.undo.length) FS.snap(p);
    $$('#strip .th[data-i]').forEach(function (b) { b.classList.toggle('on', Number(b.dataset.i) === i); });
    var cb = $('#strip .th[data-i="' + i + '"]'); if (cb && cb.scrollIntoView) cb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    FS.emit('doc'); FS.emit('history');
    if ($('[data-pane=filters]').hidden === false) buildPresets();
    if ($('[data-pane=styles]') && !$('[data-pane=styles]').hidden && FS.buildStyles) FS.buildStyles();
  }
  FS.select = select;

  /* ---------- canvas interaction ---------- */
  function docPt(e) { var r = view.getBoundingClientRect(), p = FS.cur(); return { x: (e.clientX - r.left) / r.width * p.doc.w, y: (e.clientY - r.top) / r.height * p.doc.h }; }
  var ptrs = {}, drag = null;
  function scaleLayer(L, k) {
    if (L.type === 'text') L.size = FS.clamp(L.size * k, 8, 2000);
    else if (L.type === 'emoji') L.size = FS.clamp(L.size * k, 10, 3000);
    else L.s = FS.clamp(L.s * k, 0.01, 20);
  }
  FS.scaleLayer = scaleLayer;
  view.addEventListener('pointerdown', function (e) {
    var p = FS.cur(); if (!p) return;
    view.setPointerCapture(e.pointerId);
    var pt = docPt(e); ptrs[e.pointerId] = pt;
    var ids = Object.keys(ptrs);
    if (ids.length === 2) { /* pinch */
      var a = ptrs[ids[0]], b = ptrs[ids[1]], L = S.sel && S.sel !== 'photo' ? S.sel : null;
      drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), a0: Math.atan2(b.y - a.y, b.x - a.x), L: L,
        size0: L ? JSON.stringify({ size: L.size, s: L.s, r: L.r }) : null, s0: p.doc.photo.s, r0: L ? L.r || 0 : p.doc.photo.r };
      return;
    }
    var d = p.doc, sc = FS.viewScale;
    if (S.sel && S.sel !== 'photo') { var hp = FS.handlePos(S.sel); if (Math.hypot(pt.x - hp.x, pt.y - hp.y) < 26 / sc) {
      var L0 = S.sel; drag = { mode: 'handle', L: L0, d0: Math.hypot(pt.x - L0.x, pt.y - L0.y), a0: Math.atan2(pt.y - L0.y, pt.x - L0.x), r0: L0.r || 0, snap: JSON.stringify({ size: L0.size, s: L0.s }) }; return; } }
    var hit = FS.hitLayer(d, pt.x, pt.y);
    if (hit) { S.sel = hit; drag = { mode: 'move', L: hit, ox: pt.x - hit.x, oy: pt.y - hit.y }; openLayerEditor(); }
    else { S.sel = null; drag = { mode: 'photo', ox: pt.x - d.photo.x, oy: pt.y - d.photo.y }; closeLayerEditor(); }
    FS.render();
  });
  view.addEventListener('pointermove', function (e) {
    var p = FS.cur(); if (!p) return;
    var pt = docPt(e), d = p.doc;
    if (!drag) { var h = FS.hitLayer(d, pt.x, pt.y); view.style.cursor = h ? 'move' : 'grab'; return; }
    if (ptrs[e.pointerId]) ptrs[e.pointerId] = pt;
    if (drag.mode === 'pinch') {
      var ids = Object.keys(ptrs); if (ids.length < 2) return;
      var a = ptrs[ids[0]], b = ptrs[ids[1]], k = Math.hypot(a.x - b.x, a.y - b.y) / drag.d0, ang = (Math.atan2(b.y - a.y, b.x - a.x) - drag.a0) * 180 / Math.PI;
      if (drag.L) { var o = JSON.parse(drag.size0); drag.L.size = o.size; drag.L.s = o.s; scaleLayer(drag.L, k); drag.L.r = Math.round(o.r + ang); }
      else { d.photo.s = drag.s0 * k; }
      FS.render(); return;
    }
    if (drag.mode === 'move') {
      var nx = pt.x - drag.ox, ny = pt.y - drag.oy, snap = 10 / FS.viewScale;
      if (Math.abs(nx - d.w / 2) < snap) nx = d.w / 2; if (Math.abs(ny - d.h / 2) < snap) ny = d.h / 2;
      drag.L.x = nx; drag.L.y = ny;
    } else if (drag.mode === 'photo') { d.photo.x = pt.x - drag.ox; d.photo.y = pt.y - drag.oy; }
    else if (drag.mode === 'handle') {
      var L = drag.L, o2 = JSON.parse(drag.snap); L.size = o2.size; L.s = o2.s;
      scaleLayer(L, Math.max(0.05, Math.hypot(pt.x - L.x, pt.y - L.y) / drag.d0));
      var r = drag.r0 + (Math.atan2(pt.y - L.y, pt.x - L.x) - drag.a0) * 180 / Math.PI; if (!e.shiftKey) { var q = Math.round(r / 45) * 45; if (Math.abs(r - q) < 4) r = q; }
      L.r = Math.round(r * 10) / 10;
    }
    FS.render();
  });
  function up(e) {
    delete ptrs[e.pointerId];
    if (drag && Object.keys(ptrs).length === 0) { var dm = drag; drag = null; if (dm.L && dm.L.link) syncLinked(dm.L, dm.mode === 'move' ? ['pos'] : ['size', 'r']); FS.changed(); if (S.sel) fillLayerEditor(); }
    else if (drag && drag.mode === 'pinch') drag = null;
  }
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
  view.addEventListener('dblclick', function () { if (S.sel && S.sel.type === 'text') { openTab('text'); var t = $('#le-text'); if (t) { t.focus(); t.select(); } } });
  view.addEventListener('wheel', function (e) {
    var p = FS.cur(); if (!p) return; e.preventDefault();
    var k = Math.exp(-e.deltaY * 0.0015);
    if (S.sel && S.sel !== 'photo') scaleLayer(S.sel, k);
    else { var pt = docPt(e), d = p.doc; d.photo.x = pt.x + (d.photo.x - pt.x) * k; d.photo.y = pt.y + (d.photo.y - pt.y) * k; d.photo.s *= k; }
    FS.render(); FS.commitSoon(); syncPhotoControls();
    clearTimeout(FS._wheelT); var WL = S.sel; FS._wheelT = setTimeout(function () { if (WL && WL !== 'photo' && WL.link) syncLinked(WL, ['size']); }, 400);
  }, { passive: false });
  document.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    var ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); FS.undo(); }
    else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); FS.redo(); }
    else if (ctrl && k === 's') { e.preventDefault(); FS.saveCurrent && FS.saveCurrent(); }
    else if (ctrl && k === 'p') { e.preventDefault(); FS.printNow && FS.printNow(); }
    else if (ctrl && k === 'd' && S.sel && S.sel !== 'photo') { e.preventDefault(); dupLayer(); }
    else if ((k === 'delete' || k === 'backspace') && S.sel && S.sel !== 'photo') { e.preventDefault(); delLayer(); }
    else if (k === 'escape') { S.sel = null; closeLayerEditor(); FS.render(); }
    else if (/^arrow/.test(k) && FS.cur()) {
      e.preventDefault(); var st = e.shiftKey ? 20 : 3, t = S.sel && S.sel !== 'photo' ? S.sel : FS.cur().doc.photo;
      if (k === 'arrowleft') t.x -= st; if (k === 'arrowright') t.x += st; if (k === 'arrowup') t.y -= st; if (k === 'arrowdown') t.y += st;
      FS.render(); FS.commitSoon();
    }
  });
  $('#undo').addEventListener('click', FS.undo); $('#redo').addEventListener('click', FS.redo);
  var cmp = $('#compare');
  ['pointerdown'].forEach(function (ev) { cmp.addEventListener(ev, function () { S.showOriginal = true; FS.render(); }); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { cmp.addEventListener(ev, function () { if (S.showOriginal) { S.showOriginal = false; FS.render(); } }); });

  /* ---------- photo tab ---------- */
  $$('[data-act]').forEach(function (b) { b.addEventListener('click', function () {
    var p = FS.cur(); if (!p) return; var ph = p.doc.photo, im = FS.img(p.src);
    switch (b.dataset.act) {
      case 'rot-l': ph.r = (ph.r - 90) % 360; FS.fitPhoto(p.doc, im); break;
      case 'rot-r': ph.r = (ph.r + 90) % 360; FS.fitPhoto(p.doc, im); break;
      case 'flip-h': ph.fh = !ph.fh; break;
      case 'flip-v': ph.fv = !ph.fv; break;
      case 'fit-cover': FS.fitPhoto(p.doc, im); break;
      case 'fit-contain': FS.fitPhoto(p.doc, im, 'contain'); break;
    }
    var act = b.dataset.act;
    FS.batch(function (q, c) { var qp = q.doc.photo, qi = FS.img(q.src);
      if (/rot/.test(act)) { qp.r = c.doc.photo.r; FS.fitPhoto(q.doc, qi); } else if (act === 'flip-h') qp.fh = c.doc.photo.fh; else if (act === 'flip-v') qp.fv = c.doc.photo.fv; else FS.fitPhoto(q.doc, qi, act === 'fit-contain' ? 'contain' : null); });
    FS.changed();
  }); });
  function syncPhotoControls() {
    var p = FS.cur(); if (!p) return; var ph = p.doc.photo, im = FS.img(p.src);
    var base = ph.r - Math.round(ph.r / 90) * 90; $('#straight').value = base; $('#o-straight').textContent = base + '°';
    var d = p.doc; var cover = 1; if (im) { var h = FS.hole(d), rot = Math.abs(Math.round(ph.r / 90)) % 2; cover = Math.max(h.w / (rot ? im.naturalHeight : im.naturalWidth), h.h / (rot ? im.naturalWidth : im.naturalHeight)); }
    var z = Math.round(ph.s / cover * 100); $('#pzoom').value = z; $('#o-zoom').textContent = z + '%';
    $('#page-bg').value = d.bg;
  }
  $('#straight').addEventListener('input', function () { var p = FS.cur(); if (!p) return; var ph = p.doc.photo; ph.r = Math.round(ph.r / 90) * 90 + Number(this.value); $('#o-straight').textContent = this.value + '°'; FS.render(true); FS.commitSoon(); });
  $('#pzoom').addEventListener('input', function () {
    var p = FS.cur(); if (!p) return; var d = p.doc, im = FS.img(p.src), h = FS.hole(d), rot = Math.abs(Math.round(d.photo.r / 90)) % 2;
    var cover = Math.max(h.w / (rot ? im.naturalHeight : im.naturalWidth), h.h / (rot ? im.naturalWidth : im.naturalHeight));
    d.photo.s = cover * this.value / 100; $('#o-zoom').textContent = this.value + '%'; FS.render(true); FS.commitSoon();
  });
  $('#page-bg').addEventListener('input', function () { var p = FS.cur(); if (!p) return; p.doc.bg = this.value; var v = this.value; FS.targets().forEach(function (q) { q.doc.bg = v; q.cache = q === p ? q.cache : {}; }); FS.render(); FS.commitSoon(); });

  /* ---------- adjustments ---------- */
  var SL = [
    ['אור', [['exposure', 'חשיפה', -100, 100], ['brightness', 'בהירות', -100, 100], ['contrast', 'ניגודיות', -100, 100], ['highlights', 'אזורים בהירים', -100, 100], ['shadows', 'צללים', -100, 100], ['whites', 'לבנים', -100, 100], ['blacks', 'שחורים', -100, 100]]],
    ['צבע', [['temp', 'טמפרטורה', -100, 100], ['tint', 'גוון ירוק/מג׳נטה', -100, 100], ['vibrance', 'חיות', -100, 100], ['saturation', 'רוויה', -100, 100], ['hue', 'סיבוב גוון', -180, 180], ['mono', 'שחור־לבן', 0, 100]]],
    ['פרטים', [['clarity', 'בהירות פרטים (Clarity)', -100, 100], ['sharpen', 'חדות', 0, 100]]],
    ['אפקטים', [['vignette', 'וינייט', -100, 100], ['grain', 'גרעיניות', 0, 100], ['fade', 'דהייה (מט)', 0, 100]]]
  ];
  $('#sliders').innerHTML = SL.map(function (g) {
    return '<details open><summary>' + g[0] + '</summary>' + g[1].map(function (s) {
      return '<div class="field sl"><label for="a-' + s[0] + '">' + s[1] + ' <output id="o-' + s[0] + '">0</output></label><input type="range" id="a-' + s[0] + '" data-adj="' + s[0] + '" min="' + s[2] + '" max="' + s[3] + '" value="0" /></div>';
    }).join('') + '</details>';
  }).join('');
  $$('[data-adj]').forEach(function (r) {
    r.addEventListener('input', function () { var p = FS.cur(); if (!p) return; p.doc.photo.adj[r.dataset.adj] = Number(r.value); p.doc.photo.preset = null; $('#o-' + r.dataset.adj).textContent = r.value; FS.render(true); });
    r.addEventListener('change', function () { FS.batch(function (q, c) { q.doc.photo.adj = JSON.parse(JSON.stringify(c.doc.photo.adj)); q.doc.photo.preset = null; }); FS.changed(); });
    r.addEventListener('dblclick', function () { r.value = 0; r.dispatchEvent(new Event('input')); FS.changed(); });
  });
  $('#tone').addEventListener('change', function () { var p = FS.cur(); if (!p) return; p.doc.photo.adj.tone = this.value; var v = this.value; FS.batch(function (q) { q.doc.photo.adj.tone = v; }); FS.changed(); });
  $('#auto').addEventListener('click', function () { var p = FS.cur(); if (!p) return; p.doc.photo.adj = FS.autoAdjust(p); FS.batch(function (q) { q.doc.photo.adj = FS.autoAdjust(q); }); FS.changed(); FS.toast('✨ שופר אוטומטית. אפשר לכוונן בפסים.'); });
  $('#reset-adj').addEventListener('click', function () { var p = FS.cur(); if (!p) return; p.doc.photo.adj = Object.assign({}, FS.ADJ0); p.doc.photo.preset = null; FS.batch(function (q) { q.doc.photo.adj = Object.assign({}, FS.ADJ0); q.doc.photo.preset = null; }); FS.changed(); });
  var clip = null;
  $('#copy-adj').addEventListener('click', function () { var p = FS.cur(); if (!p) return; clip = JSON.parse(JSON.stringify(p.doc.photo.adj)); $('#paste-adj').disabled = false; FS.toast('העריכה הועתקה'); });
  $('#paste-adj').addEventListener('click', function () { var p = FS.cur(); if (!p || !clip) return; p.doc.photo.adj = JSON.parse(JSON.stringify(clip)); FS.changed(); });
  $('#adj-all').addEventListener('click', function () { var p = FS.cur(); if (!p) return; var a = JSON.stringify(p.doc.photo.adj); S.photos.forEach(function (q) { if (q !== p) { q.doc.photo.adj = JSON.parse(a); FS.snap(q); } }); buildStrip(); FS.toast('העריכה הוחלה על ' + S.photos.length + ' תמונות'); });
  function syncAdj() { var p = FS.cur(); if (!p) return; var a = p.doc.photo.adj; $$('[data-adj]').forEach(function (r) { r.value = a[r.dataset.adj] || 0; $('#o-' + r.dataset.adj).textContent = a[r.dataset.adj] || 0; }); $('#tone').value = a.tone || 'none'; }

  /* ---------- presets ---------- */
  FS.PRESETS = [
    ['original', 'מקורי', {}], ['vivid', 'חי', { vibrance: 40, contrast: 15, clarity: 15, saturation: 8 }],
    ['golden', 'שעת זהב', { temp: 35, vibrance: 20, highlights: -15, shadows: 15, tone: 'gold' }], ['cool', 'קר', { temp: -30, tint: -5, contrast: 10 }],
    ['vintage', 'וינטג׳', { fade: 40, saturation: -25, temp: 20, grain: 25, vignette: 30, tone: 'sepia', mono: 15 }], ['bw', 'שחור־לבן', { mono: 100, contrast: 25, clarity: 20 }],
    ['noir', 'נואר', { mono: 100, contrast: 60, blacks: -30, vignette: 45, grain: 18 }], ['drama', 'דרמטי', { contrast: 35, clarity: 45, highlights: -40, shadows: 30, vignette: 30, saturation: -10 }],
    ['wedding', 'רך לחתונות', { exposure: 10, contrast: -15, highlights: -20, fade: 15, temp: 8, vibrance: -5, clarity: -20 }], ['film', 'פילם', { fade: 25, grain: 30, tone: 'teal', contrast: 10, saturation: -10 }],
    ['summer', 'קיץ', { exposure: 12, vibrance: 35, temp: 18, tint: 5, shadows: 20 }], ['night', 'לילה', { temp: -40, exposure: -15, contrast: 20, vignette: 40, tone: 'cool' }],
    ['pastel', 'פסטל', { exposure: 15, contrast: -30, saturation: -20, fade: 30, tint: 8 }], ['matte', 'מט', { fade: 45, contrast: -10, blacks: 20 }],
    ['hdr', 'HDR', { highlights: -70, shadows: 70, clarity: 60, vibrance: 30, sharpen: 30 }], ['sepia', 'ספיה', { mono: 70, tone: 'sepia', fade: 15 }],
    ['cinema', 'קולנועי', { tone: 'teal', contrast: 25, saturation: -15, vignette: 25, blacks: -15 }], ['food', 'אוכל', { exposure: 8, temp: 12, vibrance: 35, clarity: 20, sharpen: 25 }]
  ];
  function presetAdj(vals, k) { var a = Object.assign({}, FS.ADJ0); for (var key in vals) a[key] = key === 'tone' ? (k > 0.3 ? vals[key] : 'none') : Math.round(vals[key] * k); return a; }
  FS.presetAdj = presetAdj;
  function myPresets() { try { return JSON.parse(localStorage.getItem('frame-studio-presets') || '[]'); } catch (e) { return []; } }
  function presetThumb(p, adj) {
    var im = FS.img(p.src), k = 150 / Math.max(im.naturalWidth, im.naturalHeight), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0, c.width, c.height); var id = x.getImageData(0, 0, c.width, c.height); FS.adjustPixels(id.data, c.width, c.height, adj, true); x.putImageData(id, 0, 0); return c;
  }
  FS.presetThumb = presetThumb;
  function presetBtn(p, id, name, vals, mine) {
    var b = document.createElement('button'); b.className = 'tile' + (p.doc.photo.preset === id ? ' on' : '');
    b.appendChild(presetThumb(p, presetAdj(vals, 1))); var s = document.createElement('span'); s.textContent = name; b.appendChild(s);
    b.addEventListener('click', function () { var k = Number($('#fstr').value) / 100; p.doc.photo.adj = presetAdj(vals, k); p.doc.photo.preset = id; FS.batch(function (q) { q.doc.photo.adj = presetAdj(vals, k); q.doc.photo.preset = id; }); FS.changed(); buildPresetsMarks(); });
    if (mine) { var x = document.createElement('i'); x.className = 'x'; x.textContent = '✕'; x.addEventListener('click', function (e) { e.stopPropagation(); localStorage.setItem('frame-studio-presets', JSON.stringify(myPresets().filter(function (q) { return q.id !== id; }))); buildPresets(); }); b.appendChild(x); }
    b.dataset.id = id; return b;
  }
  function buildPresetsMarks() { var p = FS.cur(); $$('#presets .tile, #my-presets .tile').forEach(function (b) { b.classList.toggle('on', !!p && b.dataset.id === p.doc.photo.preset); }); }
  function buildPresets() {
    var p = FS.cur(), g = $('#presets'), m = $('#my-presets'); g.innerHTML = ''; m.innerHTML = '';
    if (!p) { g.innerHTML = '<p class="empty">בוחרים תמונה קודם.</p>'; return; }
    FS.PRESETS.forEach(function (q) { g.appendChild(presetBtn(p, q[0], q[1], q[2])); });
    myPresets().forEach(function (q) { m.appendChild(presetBtn(p, q.id, q.name, q.adj, true)); });
  }
  $('#fstr').addEventListener('input', function () {
    $('#o-fstr').textContent = this.value + '%'; var p = FS.cur(); if (!p || !p.doc.photo.preset) return;
    var q = FS.PRESETS.filter(function (x) { return x[0] === p.doc.photo.preset; })[0], vals = q ? q[2] : (myPresets().filter(function (x) { return x.id === p.doc.photo.preset; })[0] || {}).adj;
    if (vals) { p.doc.photo.adj = presetAdj(vals, this.value / 100); FS.render(true); FS.commitSoon(); syncAdj(); }
  });
  $('#save-preset').addEventListener('click', function () {
    var p = FS.cur(); if (!p) return; var name = prompt('שם לפילטר:', 'הפילטר שלי'); if (!name) return;
    var a = {}; for (var k in p.doc.photo.adj) if (p.doc.photo.adj[k] && p.doc.photo.adj[k] !== 'none') a[k] = p.doc.photo.adj[k];
    var list = myPresets(); list.push({ id: 'm' + FS.uid(), name: name, adj: a }); localStorage.setItem('frame-studio-presets', JSON.stringify(list)); buildPresets(); FS.toast('הפילטר נשמר');
  });

  /* ---------- frames panel ---------- */
  function frameTile(name, canvasOrImg, on, onClick, onDel) {
    var b = document.createElement('button'); b.className = 'tile frame' + (on ? ' on' : ''); b.appendChild(canvasOrImg);
    var s = document.createElement('span'); s.textContent = name; b.appendChild(s); b.addEventListener('click', onClick);
    if (onDel) { var x = document.createElement('i'); x.className = 'x'; x.textContent = '✕'; x.title = 'מחיקה'; x.addEventListener('click', function (e) { e.stopPropagation(); onDel(); }); b.appendChild(x); }
    return b;
  }
  function framePreview(p, ref) {
    var d = p ? p.doc : { w: 1200, h: 1800 }, k = 130 / Math.max(d.w, d.h), c = FS.canvas(d.w * k, d.h * k), x = c.getContext('2d');
    if (p) { var tmp = { src: p.src, doc: JSON.parse(JSON.stringify(p.doc)), cache: p.cache, mask: p.mask, maskV: p.maskV }; FS.setFrame(tmp, ref, { quiet: true }); FS.draw(x, tmp, { scale: k, max: 300, fast: true }); }
    else { x.fillStyle = '#556'; x.fillRect(0, 0, c.width, c.height); var dd = { w: d.w, h: d.h, frame: ref, layers: [] }; x.save(); x.scale(k, k); FS.drawFrame(x, dd); x.restore(); }
    return c;
  }
  function buildFrames() {
    var p = FS.cur(), g = $('#gen-frames'), u = $('#user-frames'), cur = p && p.doc.frame;
    g.innerHTML = '';
    FS.GEN_FRAMES.filter(function (f) { return f.base; }).forEach(function (f) {
      g.appendChild(frameTile(f.name, framePreview(p, { kind: 'gen', id: f.id }), cur && cur.kind === 'gen' && cur.id === f.id, function () { useFrame({ kind: 'gen', id: f.id, color: f.color, thick: 1, opacity: 1 }); }));
    });
    var ids = Object.keys(FS.USER_FRAMES);
    u.innerHTML = ids.length ? '' : '<p class="empty">עדיין אין. מוסיפים PNG עם חלון שקוף, או שומרים מסגרת מעוצבת מלשונית "שמירה".</p>';
    ids.forEach(function (id) {
      var f = FS.USER_FRAMES[id];
      u.appendChild(frameTile(f.name + (f.solid ? ' ⚠' : ''), framePreview(p, { kind: 'png', id: id }), cur && cur.kind === 'png' && cur.id === id,
        function () { useFrame({ kind: 'png', id: id, opacity: 1, tint: '#d4a843', tintAmt: 0, clip: false }); if (f.solid) FS.toast('במסגרת הזאת אין אזור שקוף, אז היא מכסה את כל התמונה. כדאי לשמור אותה כ־PNG עם חלון שקוף.', 6000); },
        function () { if (confirm('למחוק את המסגרת "' + f.name + '"?')) FS.deleteUserFrame(id).then(buildFrames); }));
    });
    syncFrameOpts();
  }
  FS.buildFrames = buildFrames;
  /* clearing every frame kept in this browser (asked once after the move to plain base frames; also a button) */
  function clearUserFrames(ask) {
    var ids = Object.keys(FS.USER_FRAMES); if (!ids.length) { if (ask) FS.toast('אין מסגרות שמורות'); return Promise.resolve(); }
    if (ask && !confirm('למחוק את כל ' + ids.length + ' המסגרות השמורות? אי אפשר לבטל.')) return Promise.resolve();
    S.photos.forEach(function (p) { if (p.doc.frame && p.doc.frame.kind === 'png') { p.doc.frame = null; p.cache = {}; } });
    return Promise.all(ids.map(function (id) { return FS.deleteUserFrame(id); })).then(function () { buildFrames(); FS.render(); FS.toast('🗑 ' + ids.length + ' מסגרות נמחקו'); });
  }
  $('#frames-clear').addEventListener('click', function () { clearUserFrames(true); });
  FS.clearUserFrames = clearUserFrames;
  function useFrame(ref) {
    var p = FS.cur(); if (!p) { FS.toast('בוחרים תמונה קודם'); return; }
    var texts = null; FS.setFrame(p, ref); syncFmt();
    FS.batch(function (q, c) { if (q.doc.fmt !== c.doc.fmt) FS.applyFormat(q.doc, c.doc.fmt, FS.img(q.src), c.doc.mm ? c.doc.mm[0] : c.doc.w, c.doc.mm ? c.doc.mm[1] : c.doc.h); FS.setFrame(q, JSON.parse(JSON.stringify(ref)), { quiet: true }); });
    FS.changed(); buildFrames(); void texts;
    if (FS.targets().length > 1) FS.toast('🖼️ המסגרת הוחלה על ' + FS.targets().length + ' תמונות מסומנות');
  }
  FS.useFrame = useFrame;
  function syncFrameOpts() {
    var p = FS.cur(), f = p && p.doc.frame; $('#frame-opts').hidden = !f; if (!f) return;
    $$('.gen-only').forEach(function (e) { e.hidden = f.kind !== 'gen'; }); $$('.png-only').forEach(function (e) { e.hidden = f.kind !== 'png'; });
    if (f.kind === 'gen') { $('#frame-color').value = f.color || '#ffffff'; $('#frame-thick').value = Math.round((f.thick || 1) * 100); $('#o-thick').textContent = $('#frame-thick').value + '%'; }
    else { $('#frame-tint').value = f.tint || '#d4a843'; $('#frame-tint-amt').value = Math.round((f.tintAmt || 0) * 100); $('#frame-clip').checked = !!f.clip; }
    $('#frame-op').value = Math.round((f.opacity == null ? 1 : f.opacity) * 100); $('#o-fop').textContent = $('#frame-op').value + '%';
  }
  function frameProp(fn, refit) { return function () { var p = FS.cur(); if (!p || !p.doc.frame) return; fn(p.doc.frame, this); if (refit) FS.fitPhoto(p.doc, FS.img(p.src)); var el = this; FS.batch(function (q) { if (q.doc.frame && q.doc.frame.id === p.doc.frame.id) { fn(q.doc.frame, el); if (refit) FS.fitPhoto(q.doc, FS.img(q.src)); } }); FS.render(true); FS.commitSoon(); syncFrameOpts(); }; }
  $('#frame-color').addEventListener('input', frameProp(function (f, el) { f.color = el.value; }));
  $('#frame-thick').addEventListener('input', frameProp(function (f, el) { f.thick = el.value / 100; }, true));
  $('#frame-tint').addEventListener('input', frameProp(function (f, el) { f.tint = el.value; if (!f.tintAmt) f.tintAmt = 0.6; }));
  $('#frame-tint-amt').addEventListener('input', frameProp(function (f, el) { f.tintAmt = el.value / 100; }));
  $('#frame-clip').addEventListener('change', frameProp(function (f, el) { f.clip = el.checked; }));
  $('#frame-op').addEventListener('input', frameProp(function (f, el) { f.opacity = el.value / 100; }));
  $('#frame-none').addEventListener('click', function () { var p = FS.cur(); if (!p) return; FS.setFrame(p, null); FS.batch(function (q) { FS.setFrame(q, null); }); FS.changed(); buildFrames(); });
  $('#frame-all-btn').addEventListener('click', function () {
    var p = FS.cur(); if (!p || !p.doc.frame) return; var ref = JSON.stringify(p.doc.frame);
    var texts = p.doc.layers.filter(function (L) { return L.frameText; });
    S.photos.forEach(function (q) { if (q === p) return; var oldFmt = q.doc.fmt; if (p.doc.fmt !== oldFmt) FS.applyFormat(q.doc, p.doc.fmt, FS.img(q.src), p.doc.w, p.doc.h);
      FS.setFrame(q, JSON.parse(ref), { quiet: true, noTexts: true }); texts.forEach(function (L) { q.doc.layers.push(Object.assign(JSON.parse(JSON.stringify(L)), { id: FS.uid() })); }); FS.snap(q); });
    buildStrip(); FS.toast('המסגרת הוחלה על כל ' + S.photos.length + ' התמונות');
  });
  FS.addFrameFiles = function (files) {
    var list = Array.prototype.slice.call(files || []); if (!list.length) return;
    FS.busy('מוסיף מסגרות…');
    Promise.all(list.map(function (f) { return FS.fileToDataURL(f).then(function (src) { return FS.addUserFrame(src, f.name.replace(/\.[^.]+$/, '')); }); })).then(function (fr) {
      FS.busy(); buildFrames(); if (fr.length === 1 && FS.cur()) useFrame({ kind: 'png', id: fr[0].id, opacity: 1, tint: '#d4a843', tintAmt: 0, clip: false });
      FS.toast(fr.length + ' מסגרות נוספו ונשמרו בדפדפן');
    }).catch(function () { FS.busy(); FS.toast('המסגרת לא נפתחה'); });
  };
  $('#file-frames').addEventListener('change', function () { FS.addFrameFiles(this.files); this.value = ''; });

  /* ---------- text & stickers ---------- */
  var EMOJI = '❤️ 💖 💍 👰 🤵 🎂 🎈 🎉 🎁 🥂 🍾 🌹 🌸 🌼 🌿 🍃 ⭐ ✨ 🌟 💫 🔥 ☀️ 🌙 🌈 ☁️ 🦋 🕊️ 👑 🕶️ 🎩 💋 😍 😂 🥳 😎 🤩 😇 👶 🍼 🧸 ✡️ 🕎 🍷 🍯 🍎 🎃 🎄 ⚽ 🏆 📸 🎵 💯 ✅ 👍 🙌 💐 🐶 🐱'.split(' ');
  $('#emojis').innerHTML = EMOJI.map(function (e) { return '<button data-em="' + e + '">' + e + '</button>'; }).join('');
  $$('#emojis [data-em]').forEach(function (b) { b.addEventListener('click', function () { addLayer({ type: 'emoji', ch: b.dataset.em, size: Math.round(Math.min(FS.cur() ? FS.cur().doc.w : 1000, FS.cur() ? FS.cur().doc.h : 1000) * 0.14) }); }); });
  function addLayer(L) {
    var p = FS.cur(); if (!p) { FS.toast('בוחרים תמונה קודם'); return null; }
    var d = p.doc; L = Object.assign({ id: FS.uid(), x: d.w / 2, y: d.h / 2, r: 0, opacity: 1 }, L);
    d.layers.push(L);
    if (FS.targets().length > 1) { L.link = L.link || L.id; FS.batch(function (q) { q.doc.layers.push(cloneTo(L, d, q.doc)); }); }
    S.sel = L; FS.changed(); openLayerEditor(); return L;
  }
  FS.addLayer = addLayer;
  /* a layer moved to another page size: same relative place, size by the shorter side */
  function cloneTo(L, from, to) {
    var n = JSON.parse(JSON.stringify(L)), k = Math.min(to.w, to.h) / Math.min(from.w, from.h);
    n.id = FS.uid(); n.x = L.x / from.w * to.w; n.y = L.y / from.h * to.h; if (n.size) n.size = L.size * k; if (n.s) n.s = L.s * k; return n;
  }
  /* the edit on the selected layer reaches the same layer on every marked photo */
  function syncLinked(L, keys) {
    if (!L || !L.link || FS.targets().length < 2) return;
    var d = FS.cur().doc;
    FS.batch(function (q) {
      var x = FS.linked(q, L); if (!x) return; var k = Math.min(q.doc.w, q.doc.h) / Math.min(d.w, d.h);
      keys.forEach(function (key) {
        if (key === 'pos') { x.x = L.x / d.w * q.doc.w; x.y = L.y / d.h * q.doc.h; }
        else if (key === 'size') { if (L.size != null) x.size = L.size * k; if (L.s != null) x.s = L.s * k; }
        else x[key] = L[key] == null ? L[key] : JSON.parse(JSON.stringify(L[key]));
      });
    });
  }
  FS.syncLinked = syncLinked;
  $('#add-text').addEventListener('click', function () {
    var d = FS.cur() && FS.cur().doc; if (!d) { FS.toast('בוחרים תמונה קודם'); return; }
    addLayer({ type: 'text', text: 'הטקסט שלי', size: Math.round(Math.min(d.w, d.h) * 0.08), font: 'Heebo', weight: 800, color: '#ffffff', strokeW: 0, stroke: '#000000', shadow: true, align: 'center', bg: '#000000', bgOn: false });
    setTimeout(function () { var t = $('#le-text'); if (t) { t.focus(); t.select(); } }, 50);
  });
  $('#file-sticker').addEventListener('change', function () {
    var f = this.files[0]; this.value = ''; if (!f) return;
    FS.fileToDataURL(f).then(FS.loadImg).then(function (im) { var d = FS.cur().doc; addLayer({ type: 'image', src: im.src, s: Math.min(d.w, d.h) * 0.35 / Math.max(im.naturalWidth, im.naturalHeight) }); });
  });
  function closeLayerEditor() { $('#layer-edit').hidden = true; syncLayers(); }
  function openLayerEditor() { if (!S.sel || S.sel === 'photo') return closeLayerEditor(); openTab('text'); fillLayerEditor(); }
  FS.openLayerEditor = openLayerEditor;
  function fillLayerEditor() {
    var L = S.sel, box = $('#layer-edit'); if (!L || L === 'photo') { box.hidden = true; return; }
    box.hidden = false;
    var h = '';
    if (L.type === 'text') {
      h += '<textarea id="le-text" rows="2">' + FS.esc(L.text) + '</textarea>';
      h += '<div class="field"><label>גופן</label><select data-k="font">' + FS.FONTS.map(function (f) { return '<option value="' + f[0] + '"' + (L.font === f[0] ? ' selected' : '') + ' style="font-family:\'' + f[0] + '\'">' + f[1] + '</option>'; }).join('') + '</select></div>';
      h += '<div class="inline"><button class="tg' + (L.weight >= 700 ? ' on' : '') + '" data-tg="bold"><b>B</b></button><button class="tg' + (L.italic ? ' on' : '') + '" data-tg="italic"><i>I</i></button><button class="tg' + (L.shadow ? ' on' : '') + '" data-tg="shadow">צל</button><button class="tg' + (L.bgOn ? ' on' : '') + '" data-tg="bgOn">רקע</button>'
        + '<select data-k="align"><option value="center">מרכז</option><option value="right"' + (L.align === 'right' ? ' selected' : '') + '>ימין</option><option value="left"' + (L.align === 'left' ? ' selected' : '') + '>שמאל</option></select></div>';
      h += '<div class="inline colors"><label>צבע <input type="color" data-k="color" value="' + (L.color || '#ffffff') + '"></label><label>מעבר <input type="color" data-k="grad" value="' + (L.grad || L.color || '#ffffff') + '"><input type="checkbox" data-tg2="grad"' + (L.grad ? ' checked' : '') + '></label>'
        + '<label>קו <input type="color" data-k="stroke" value="' + (L.stroke || '#000000') + '"></label><label>רקע <input type="color" data-k="bg" value="' + (L.bg || '#000000') + '"></label></div>';
      h += rng('size', 'גודל', 8, Math.round(Math.max(FS.cur().doc.w, FS.cur().doc.h) * 0.4), L.size) + rng('strokeW', 'עובי קו', 0, 60, L.strokeW || 0) + rng('spacing', 'ריווח אותיות', -10, 60, L.spacing || 0) + rng('lh', 'ריווח שורות', 0.8, 2.2, L.lh || 1.18, 0.02);
    } else {
      h += L.type === 'emoji' ? rng('size', 'גודל', 10, Math.round(Math.max(FS.cur().doc.w, FS.cur().doc.h) * 0.8), L.size) : rng('s', 'גודל', 0.01, Math.max(2, L.s * 3), L.s, 0.001);
      h += '<div class="inline"><button class="tg' + (L.flip ? ' on' : '') + '" data-tg="flip">⇋ היפוך</button><button class="tg' + (L.shadow ? ' on' : '') + '" data-tg="shadow">צל</button></div>';
    }
    h += rng('r', 'סיבוב', -180, 180, L.r || 0) + rng('opacity', 'שקיפות', 0.05, 1, L.opacity == null ? 1 : L.opacity, 0.01);
    h += '<div class="row3"><button class="btn small" data-la="center">⌖ מרכז</button><button class="btn small" data-la="up">⬆ קדימה</button><button class="btn small" data-la="down">⬇ אחורה</button><button class="btn small" data-la="dup">⧉ שכפול</button><button class="btn small" data-la="lock">🔒 נעילה</button><button class="btn small danger" data-la="del">🗑 מחיקה</button></div>';
    box.innerHTML = h;
    function rng(k, label, mn, mx, v, st) { return '<div class="field"><label>' + label + ' <output>' + Math.round(v * 100) / 100 + '</output></label><input type="range" data-k="' + k + '" min="' + mn + '" max="' + mx + '" step="' + (st || 1) + '" value="' + v + '"></div>'; }
    var t = $('#le-text'); if (t) { t.addEventListener('input', function () { L.text = t.value; FS.render(); FS.commitSoon(); syncLayers(); }); t.addEventListener('change', function () { syncLinked(L, ['text']); }); }
    $$('[data-k]', box).forEach(function (el) {
      el.addEventListener('input', function () {
        var v = el.type === 'range' ? Number(el.value) : el.value;
        if (el.dataset.k === 'grad') { var cb = $('[data-tg2=grad]', box); cb.checked = true; }
        L[el.dataset.k] = v; var o = el.parentNode.querySelector('output'); if (o) o.textContent = Math.round(v * 100) / 100;
        if (el.dataset.k === 'font' && document.fonts) document.fonts.load('700 40px "' + v + '"').then(function () { FS.render(); });
        FS.render(true); FS.commitSoon();
      });
      el.addEventListener('change', function () { var k = el.dataset.k; syncLinked(L, [k === 'size' || k === 's' ? 'size' : k]); });
    });
    var g2 = $('[data-tg2=grad]', box); if (g2) g2.addEventListener('change', function () { L.grad = g2.checked ? $('[data-k=grad]', box).value : null; syncLinked(L, ['grad']); FS.changed(); });
    $$('[data-tg]', box).forEach(function (b) { b.addEventListener('click', function () {
      var k = b.dataset.tg; if (k === 'bold') L.weight = L.weight >= 700 ? 400 : 800; else L[k] = !L[k];
      syncLinked(L, [k === 'bold' ? 'weight' : k]); b.classList.toggle('on'); FS.changed(); }); });
    $$('[data-la]', box).forEach(function (b) { b.addEventListener('click', function () { layerAct(b.dataset.la); }); });
  }
  function layerAct(a) {
    var p = FS.cur(), L = S.sel; if (!p || !L) return; var arr = p.doc.layers, i = arr.indexOf(L);
    if (a === 'center') { L.x = p.doc.w / 2; L.y = p.doc.h / 2; syncLinked(L, ['pos']); }
    else if (a === 'up' && i < arr.length - 1) { arr.splice(i, 1); arr.splice(i + 1, 0, L); }
    else if (a === 'down' && i > 0) { arr.splice(i, 1); arr.splice(i - 1, 0, L); }
    else if (a === 'dup') return dupLayer();
    else if (a === 'del') return delLayer();
    else if (a === 'lock') { L.locked = true; S.sel = null; closeLayerEditor(); FS.toast('השכבה ננעלה. פותחים אותה ברשימת השכבות.'); }
    FS.changed();
  }
  function dupLayer() { var p = FS.cur(), L = S.sel; var c = JSON.parse(JSON.stringify(L)); c.id = FS.uid(); c.x += 30; c.y += 30; delete c.frameText; p.doc.layers.push(c); S.sel = c; FS.changed(); fillLayerEditor(); }
  function delLayer() { var p = FS.cur(), L = S.sel; if (L && L.link) FS.batch(function (q) { var x = FS.linked(q, L); if (x) q.doc.layers = q.doc.layers.filter(function (y) { return y !== x; }); }); p.doc.layers = p.doc.layers.filter(function (x) { return x !== L; }); S.sel = null; closeLayerEditor(); FS.changed(); }
  $('#layers-to-marked').addEventListener('click', function () {
    var c = FS.cur(), m = FS.marked().filter(function (q) { return q !== c; }); if (!c || !m.length) return FS.toast('מסמנים תמונות נוספות בפס התמונות (Ctrl+לחיצה)');
    var Ls = c.doc.layers.filter(function (L) { return !L.frameText; });
    Ls.forEach(function (L) { L.link = L.link || L.id; });
    m.forEach(function (q) { Ls.forEach(function (L) { var n = JSON.parse(JSON.stringify(L)); n.id = FS.uid(); n.x = L.x / c.doc.w * q.doc.w; n.y = L.y / c.doc.h * q.doc.h; var k = Math.min(q.doc.w, q.doc.h) / Math.min(c.doc.w, c.doc.h); if (n.size) n.size *= k; if (n.s) n.s *= k; q.doc.layers.push(n); }); q.cache = {}; FS.snap(q); });
    FS.refreshStrip(); FS.toast(Ls.length + ' שכבות הועתקו ל־' + m.length + ' תמונות');
  });
  function syncLayers() {
    var p = FS.cur(), ol = $('#layers'); if (!ol) return;
    if (!p || !p.doc.layers.length) { ol.innerHTML = '<li class="empty">אין שכבות עדיין.</li>'; return; }
    ol.innerHTML = '';
    p.doc.layers.slice().reverse().forEach(function (L) {
      var li = document.createElement('li'); li.className = S.sel === L ? 'on' : '';
      var label = L.type === 'text' ? '🔤 ' + String(L.text).split('\n')[0].slice(0, 22) : L.type === 'emoji' ? L.ch + ' מדבקה' : '🖼️ תמונה';
      li.innerHTML = '<span>' + FS.esc(label) + '</span><button title="הסתרה">' + (L.hidden ? '🙈' : '👁') + '</button><button title="נעילה">' + (L.locked ? '🔒' : '🔓') + '</button>';
      li.addEventListener('click', function () { if (L.locked) return; S.sel = L; fillLayerEditor(); FS.render(); syncLayers(); });
      var bs = li.querySelectorAll('button');
      bs[0].addEventListener('click', function (e) { e.stopPropagation(); L.hidden = !L.hidden; FS.changed(); });
      bs[1].addEventListener('click', function (e) { e.stopPropagation(); L.locked = !L.locked; if (L.locked && S.sel === L) { S.sel = null; closeLayerEditor(); } FS.changed(); });
      ol.appendChild(li);
    });
  }

  /* ---------- keep the panels true to the current page ---------- */
  function syncPanels() {
    var p = FS.cur(); if (!p) return;
    syncFmt();
    var cmo = $('#fmt option[value=cm]'); if (cmo) { var mm = FS.mmOf(p.doc); cmo.textContent = p.doc.fmt === 'cm' ? '📐 ' + (mm[0] / 10).toFixed(1) + '×' + (mm[1] / 10).toFixed(1) + ' ס״מ (מותאם)' : '📐 גודל מותאם (ס״מ)…'; }
    syncAdj(); syncPhotoControls(); syncFrameOpts(); syncLayers();
    if (S.sel && p.doc.layers.indexOf(S.sel) < 0) { S.sel = null; $('#layer-edit').hidden = true; }
    var bg = p.doc.photo.bg || { mode: 'none' }; $$('#bg-modes [data-bg]').forEach(function (b) { b.classList.toggle('on', b.dataset.bg === bg.mode); });
  }
  FS.syncPanels = syncPanels;

  /* ---------- start ---------- */
  FS.loadUserFrames().then(function () {
    if (!$('[data-pane=frames]').hidden) buildFrames();
    /* once: the move to plain base frames offers to clear the frames this browser kept before */
    var k = 'fs-frames-clean-v1'; try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) { return; }
    if (Object.keys(FS.USER_FRAMES).length) setTimeout(function () { clearUserFrames(true); }, 1200);
  });
  openTab(FS.prefs.tab && FS.prefs.tab !== 'games' ? FS.prefs.tab : 'photos');
  if (document.fonts) document.fonts.ready.then(function () { FS.render(); });
  FS.render();
  window.addEventListener('beforeunload', function (e) { if (S.photos.length && !FS.savedOnce) { e.preventDefault(); e.returnValue = ''; } });
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; $('#install').hidden = false; });
  $('#install').addEventListener('click', function () { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; $('#install').hidden = true; } });
})();
