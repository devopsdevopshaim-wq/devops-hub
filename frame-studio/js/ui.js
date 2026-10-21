/* The editor screen: tabs, photo strip, the canvas (drag, pinch, wheel, handles), the panels and their controls. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;
  var view = $('#view'), vctx = view.getContext('2d'), wrap = $('#wrap');

  /* ---------- helpers shared with the other files ---------- */
  /* the busy sign; with onStop it shows "⏹ עצירה" (an AI run can be stopped in the middle) */
  FS.busy = function (msg, onStop) {
    var b = $('#busy'), st = $('#busy-stop'); if (msg) { $('#busy-msg').textContent = msg; b.hidden = false; } else b.hidden = true;
    if (st) { if (onStop !== undefined || !msg) st.hidden = !(msg && onStop); if (onStop) st.onclick = function () { st.hidden = true; $('#busy-msg').textContent = 'עוצר…'; onStop(); }; }
  };
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
    FS.draw(vctx, p, { scale: sc * dpr, max: fast ? Math.min(max, 640) : max, fast: fast, sel: S.sel });
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
    FS.lumaHist = H[3]; if (FS.drawCurve) FS.drawCurve();
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
  FS.on('history', function () {
    var p = FS.cur(), n = p ? p.undo.length - 1 : 0; $('#undo').disabled = !p || n < 1; $('#redo').disabled = !p || !p.redo.length;
    $('#undo').innerHTML = '↶ ביטול' + (n > 0 ? ' <small>' + n + '</small>' : ''); $('#redo').textContent = '↷ חזרה';
    var r = $('#reset-edits'); if (r) r.disabled = !p || (n < 1 && !p.origSrc);
  });
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
  /* the sizes: a fixed set of base sizes, plus as many of the owner's own as they want (in mm, kept in this browser).
     Only these show in the size menus. */
  FS.BASE_SIZES = [[75, 100], [100, 75], [100, 100], [100, 150], [150, 100], [150, 200], [200, 150]].map(function (s) { var n = (s[0] / 10) + '×' + (s[1] / 10); return { id: 'b' + s[0] + 'x' + s[1], name: n, w: s[0], h: s[1], base: true }; });
  function sameMM(a, b) { return Math.abs(a.w - b.w) < 0.6 && Math.abs(a.h - b.h) < 0.6; }
  if (!Array.isArray(FS.prefs.sizes)) FS.prefs.sizes = [];
  if (!FS.prefs.sizesV2) {   /* the first seeded sizes go; the owner's own stay unless a base size covers them */
    var OLD = { s1: [50, 75], s2: [75, 50], s3: [100, 150] };
    FS.prefs.sizes = FS.prefs.sizes.filter(function (z) { var o = OLD[z.id]; return !(o && z.w === o[0] && z.h === o[1]) && !FS.BASE_SIZES.some(function (b) { return sameMM(b, z); }); });
    FS.prefs.sizesV2 = 1; FS.savePrefs();
  }
  FS.userSizes = function () { return Array.isArray(FS.prefs.sizes) ? FS.prefs.sizes.slice() : []; };
  FS.mySizes = function () { return FS.BASE_SIZES.concat(FS.userSizes()); };
  FS.saveSize = function (name, wmm, hmm) {
    var hit = FS.mySizes().filter(function (z) { return z.w === wmm && z.h === hmm; })[0]; if (hit) return hit;
    var l = FS.userSizes();
    var z = { id: 's' + FS.uid(), name: String(name || '').slice(0, 30) || (wmm / 10) + '×' + (hmm / 10), w: wmm, h: hmm }; l.push(z);
    FS.prefs.sizes = l; FS.savePrefs(); FS.emit('sizes'); return z;
  };
  FS.delSize = function (id) { FS.prefs.sizes = FS.userSizes().filter(function (z) { return z.id !== id; }); FS.savePrefs(); FS.emit('sizes'); };
  FS.sizeLabel = function (z) { var d = (z.w / 10) + '×' + (z.h / 10); return z.name.indexOf(d) >= 0 ? z.name + ' ס״מ' : z.name + ' (' + d + ' ס״מ)'; };
  FS.sizeOf = function (v) { if (!/^my:/.test(v)) return null; return FS.mySizes().filter(function (z) { return 'my:' + z.id === v; })[0] || null; };
  /* which of my sizes a page is (by its true size), for the menus */
  FS.sizeOfDoc = function (d) { var mm = FS.mmOf(d); return FS.mySizes().filter(function (z) { return sameMM(z, { w: mm[0], h: mm[1] }); })[0] || null; };
  function fillFormats(sel) {
    function opts(l) { return l.map(function (z) { return '<option value="my:' + z.id + '">' + FS.esc(FS.sizeLabel(z)) + '</option>'; }).join(''); }
    sel.innerHTML = '<optgroup label="גדלים בסיסיים">' + opts(FS.BASE_SIZES) + '</optgroup>' + (FS.userSizes().length ? '<optgroup label="⭐ הגדלים שלי">' + opts(FS.userSizes()) + '</optgroup>' : '');
  }
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
    $('#fmt').insertAdjacentHTML('beforeend', '<option value="manage">＋ הוספת גודל / ניהול הגדלים…</option>');
    if (b && FS.sizeOf(b)) $('#fmt-new').value = b;
    syncFmt();
  }
  fillAll(); FS.on('sizes', fillAll); FS.on('doc', syncFmt);
  if (!FS.sizeOf(FS.prefs.fmt || '')) { FS.prefs.fmt = 'my:b100x150'; FS.savePrefs(); }
  $('#fmt-new').value = FS.prefs.fmt;
  $('#fmt-new').addEventListener('change', function () { FS.prefs.fmt = this.value; FS.savePrefs(); });
  /* the sizes manager: the base sizes (fixed) and the owner's own, any number, name + width + height in cm */
  FS.manageSizes = function () {
    var list = FS.userSizes().map(function (z) { return Object.assign({}, z); });
    var body = FS.dialog('📐 גדלים', '<p class="hint">הגדלים הבסיסיים קבועים. מתחתם מוסיפים כמה גדלים שרוצים (רוחב × גובה בס״מ), והם נשמרים בתוכנה ומופיעים בכל תפריטי הגודל.</p>' +
      '<h3>גדלים בסיסיים</h3><div class="sz-base">' + FS.BASE_SIZES.map(function (z) { return '<span>' + z.name + '</span>'; }).join('') + '</div>' +
      '<h3>⭐ הגדלים שלי</h3><div id="sz-rows"></div><button class="btn wide" id="sz-add">＋ הוספת גודל</button><button class="btn primary wide" id="sz-save">💾 שמירה</button>');
    function rows() {
      $('#sz-rows', body).innerHTML = list.length ? list.map(function (z, i) { return '<div class="sz-row" data-i="' + i + '"><input class="sz-n" maxlength="30" value="' + FS.esc(z.name) + '" placeholder="שם (לא חובה)"><label>רוחב<input class="sz-w" type="number" min="1" max="100" step="0.1" value="' + (z.w / 10) + '"></label><label>גובה<input class="sz-h" type="number" min="1" max="100" step="0.1" value="' + (z.h / 10) + '"></label><button class="btn small danger sz-del" title="מחיקה">🗑</button></div>'; }).join('') : '<p class="hint">עוד אין גדלים משלך. לוחצים "＋ הוספת גודל".</p>';
      $$('.sz-row', body).forEach(function (r) {
        var z = list[Number(r.dataset.i)];
        $('.sz-n', r).addEventListener('input', function () { z.name = this.value; });
        $('.sz-w', r).addEventListener('input', function () { z.w = Math.round(Number(this.value) * 10); });
        $('.sz-h', r).addEventListener('input', function () { z.h = Math.round(Number(this.value) * 10); });
        $('.sz-del', r).addEventListener('click', function () { list.splice(Number(r.dataset.i), 1); rows(); });
      });
    }
    $('#sz-add', body).addEventListener('click', function () { list.push({ id: 's' + FS.uid(), name: '', w: 60, h: 90 }); rows(); var n = $$('.sz-n', body); n[n.length - 1].focus(); });
    $('#sz-save', body).addEventListener('click', function () {
      var ok = list.filter(function (z) { return z.w > 9 && z.h > 9 && z.w <= 1000 && z.h <= 1000 && !FS.BASE_SIZES.some(function (b) { return sameMM(b, z); }); });
      ok.forEach(function (z) { z.name = String(z.name || '').trim().slice(0, 30) || (z.w / 10) + '×' + (z.h / 10); });
      FS.prefs.sizes = ok; FS.savePrefs(); FS.emit('sizes'); FS.closeDialog(); FS.toast('✔ ' + FS.mySizes().length + ' גדלים בתפריט (' + ok.length + ' משלך)');
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
    files = Array.prototype.filter.call(files || [], function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(f.name) || FS.RAW_EXT.test(f.name || ''); });
    if (!files.length) return FS.toast('לא נבחרו קבצי תמונה (JPG, PNG, WEBP או RAW).', 5000);
    var first = S.photos.length, chain = Promise.resolve(), fails = [], n = files.length, stop = false;
    function mb(f) { return f.size ? ' · ' + (f.size / 1048576).toFixed(1) + 'MB' : ''; }
    files.forEach(function (f, i) { chain = chain.then(function () {
      if (stop) return;
      FS.busy('טוען תמונות… ' + (i + 1) + ' מתוך ' + n + '\n' + (f.name || '') + mb(f), function () { stop = true; });
      /* a breath between photos so the page keeps answering, and a photo that never opens is skipped after 45s */
      return new Promise(function (ok) { setTimeout(ok, 0); }).then(function () {
        return Promise.race([FS.addPhotoFile(f), new Promise(function (_, no) { setTimeout(function () { var e = new Error('timeout'); e.why = 'נפתחה יותר מדי זמן ודילגתי עליה'; no(e); }, 45000); })]);
      }).catch(function (e) { if (window.console) console.warn(f.name, e); fails.push({ name: f.name || 'קובץ', why: (e && e.why) || (e && e.message) || 'שגיאה לא ידועה' }); });
    }); });
    chain.catch(function () {}).then(function () {
      FS.busy();
      if (fails.length) showFails(fails, n);
      if (S.photos.length > first) select(first);
      buildStrip();
      if (S.photos.length > first) FS.emit('photos-added', { from: first, n: S.photos.length - first });
    });
  }
  /* what didn't open and why, in a dialog the owner can photograph */
  function showFails(fails, n) {
    var html = '<p>' + (n - fails.length) + ' מתוך ' + n + ' תמונות נפתחו. אלה לא נפתחו:</p><ul class="fail-list">' +
      fails.slice(0, 30).map(function (x) { return '<li><b>' + FS.esc(x.name) + '</b><span>' + FS.esc(x.why) + '</span></li>'; }).join('') + '</ul>' +
      (fails.length > 30 ? '<p>ועוד ' + (fails.length - 30) + '.</p>' : '') + '<p class="hint">גרסה ' + (window.FS_V || '?') + '</p>';
    if (FS.dialog) FS.dialog('⚠️ תמונות שלא נפתחו', html); else FS.toast(fails.length + ' תמונות לא נפתחו: ' + fails[0].why, 9000);
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

  /* ---------- adjustments: Lightroom-style sections (light, colour, presence, mixer, grading, curve, effects) ---------- */
  var SL = [
    ['light', 'אור', [['exposure', 'חשיפה', -100, 100], ['contrast', 'ניגודיות', -100, 100], ['brightness', 'בהירות', -100, 100], ['highlights', 'בהירים', -100, 100], ['shadows', 'צללים', -100, 100], ['whites', 'לבנים', -100, 100], ['blacks', 'שחורים', -100, 100]]],
    ['color', 'צבע', [['temp', 'טמפרטורה', -100, 100, 'temp'], ['tint', 'גוון', -100, 100, 'tint'], ['vibrance', 'חיות', -100, 100], ['saturation', 'רוויה', -100, 100], ['hue', 'סיבוב גוון', -180, 180], ['mono', 'שחור־לבן', 0, 100]]],
    ['presence', 'נוכחות', [['texture', 'מרקם', -100, 100], ['clarity', 'בהירות פרטים', -100, 100], ['dehaze', 'הסרת אובך', -100, 100], ['sharpen', 'חדות', 0, 100]]],
    ['mixer', 'מיקסר צבעים', null], ['grade', 'דירוג צבע', null], ['curve', 'עקומה', null],
    ['effects', 'אפקטים', [['vignette', 'וינייט', -100, 100], ['grain', 'גרעיניות', 0, 100], ['fade', 'דהייה (מט)', 0, 100]]]
  ];
  var SEC_KEYS = {}, OPEN0 = { light: 1, color: 1, presence: 1 };
  SL.forEach(function (g) { SEC_KEYS[g[0]] = g[2] ? g[2].map(function (s) { return s[0]; }) : [g[0] === 'mixer' ? 'hsl' : g[0]]; });
  SEC_KEYS.color.push('tone');
  function row(id, label, mn, mx, attr, cls) {
    return '<div class="sr' + (cls ? ' ' + cls : '') + '"><label for="' + id + '">' + label + '</label><input type="range" id="' + id + '" ' + attr + ' min="' + mn + '" max="' + mx + '" value="0" step="1" />' +
      '<input type="number" class="num" data-for="' + id + '" min="' + mn + '" max="' + mx + '" value="0" step="1" aria-label="' + label + '" /></div>';
  }
  var CURVES = [['lin', 'ליניארי', [[0, 0], [255, 255]]], ['soft', 'S רך', [[0, 0], [64, 54], [192, 204], [255, 255]]], ['strong', 'S חזק', [[0, 0], [64, 38], [192, 220], [255, 255]]],
    ['matte', 'מט', [[0, 38], [70, 74], [190, 194], [255, 242]]], ['fade', 'פילם דהוי', [[0, 28], [60, 62], [128, 132], [200, 206], [255, 236]]], ['bright', 'הבהרה', [[0, 0], [118, 146], [255, 255]]], ['dark', 'החשכה', [[0, 0], [136, 108], [255, 255]]]];
  var ZONES = [['sh', 'צללים'], ['mid', 'ביניים'], ['hi', 'בהירים']];
  function secBody(g) {
    if (g[2]) return g[2].map(function (s) { return row('a-' + s[0], s[1], s[2], s[3], 'data-adj="' + s[0] + '"', s[4] ? 'col ' + s[4] : ''); }).join('') +
      (g[0] === 'color' ? '<div class="sr sel"><label for="tone">גוון מוכן</label><select id="tone"><option value="none">ללא</option><option value="sepia">ספיה</option><option value="gold">זהוב</option><option value="cool">קריר</option><option value="teal">קולנועי (כתום־טורקיז)</option><option value="portra">פילם פורטרה</option><option value="fuji">פילם פוג׳י</option><option value="kodak">פילם קודאק</option><option value="moody">מאופק</option></select></div>' : '');
    if (g[0] === 'mixer') return '<div class="mx-bands" role="radiogroup" aria-label="ערוץ צבע">' + FS.HSL_BANDS.map(function (b, i) { return '<button type="button" class="mx-dot' + (i ? '' : ' on') + '" data-band="' + b[0] + '" style="--c:' + b[2] + '" title="' + b[1] + '" aria-label="' + b[1] + '"></button>'; }).join('') + '</div>' +
      '<div class="mx-name" id="mx-name">אדום</div>' + row('m-h', 'גוון', -100, 100, 'data-mix="h"', 'col mh') + row('m-s', 'רוויה', -100, 100, 'data-mix="s"', 'col ms') + row('m-l', 'בהירות', -100, 100, 'data-mix="l"', 'col ml');
    if (g[0] === 'grade') return '<div class="gw-row">' + ZONES.map(function (z, i) { return '<figure class="gw' + (i ? '' : ' on') + '" data-zone="' + z[0] + '"><canvas width="96" height="96" aria-label="' + z[1] + '"></canvas><figcaption>' + z[1] + ' <small></small></figcaption></figure>'; }).join('') + '</div>' +
      row('g-h', 'גוון', 0, 360, 'data-grade="h"', 'col gh') + row('g-s', 'עוצמה', 0, 100, 'data-grade="s"') + row('g-bal', 'איזון', -100, 100, 'data-grade="bal"');
    if (g[0] === 'curve') return '<div class="cv-wrap"><canvas id="curve" width="512" height="512" aria-label="עקומת טונים"></canvas></div><p class="hint cv-hint">גוררים נקודה · לחיצה על הקו מוסיפה נקודה · לחיצה כפולה על נקודה מוחקת אותה</p>' +
      '<div class="chips cv-pre">' + CURVES.map(function (c) { return '<button type="button" data-curve="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>';
  }
  var openSec = FS.prefs.adjOpen || OPEN0;
  $('#sliders').innerHTML = SL.map(function (g) {
    return '<details class="ax-sec" data-sec="' + g[0] + '"' + (openSec[g[0]] ? ' open' : '') + '><summary><span class="ax-t">' + g[1] + '</span><i class="ax-mod" aria-hidden="true"></i><button type="button" class="ax-reset" data-reset="' + g[0] + '" title="איפוס ' + g[1] + '" aria-label="איפוס ' + g[1] + '">↺</button></summary><div class="ax-b">' + secBody(g) + '</div></details>';
  }).join('');
  $$('#sliders details').forEach(function (d) { d.addEventListener('toggle', function () { var o = {}; $$('#sliders details').forEach(function (x) { if (x.open) o[x.dataset.sec] = 1; }); FS.prefs.adjOpen = o; FS.savePrefs(); if (d.open && d.dataset.sec === 'curve') drawCurve(); if (d.open && d.dataset.sec === 'grade') drawWheels(); }); });

  function curAdj() { var p = FS.cur(); return p ? p.doc.photo.adj : null; }
  /* a live change while dragging (small, fast preview) and the commit afterwards (all marked photos, undo step) */
  function live(fn) { var p = FS.cur(); if (!p) return; fn(p.doc.photo.adj); p.doc.photo.preset = null; FS.render(true); }
  function commitAdj() { var p = FS.cur(); if (!p) return; p.doc.photo.preset = null; FS.batch(function (q, c) { q.doc.photo.adj = JSON.parse(JSON.stringify(c.doc.photo.adj)); q.doc.photo.preset = null; }); FS.changed(); }
  /* the track fill: from the centre for -x..x sliders, from the start otherwise */
  function fill(r) {
    var mn = Number(r.min), mx = Number(r.max), v = Number(r.value), z = mn < 0 ? -mn / (mx - mn) : 0, t = (v - mn) / (mx - mn);
    r.style.setProperty('--a', (Math.min(z, t) * 100).toFixed(1) + '%'); r.style.setProperty('--b', (Math.max(z, t) * 100).toFixed(1) + '%');
  }
  function setRow(r, v) { r.value = v; fill(r); var n = r.parentNode.querySelector('.num'); if (n && document.activeElement !== n) n.value = Math.round(v); }
  /* the numeric boxes drive their sliders; a double-click on a slider (or its label) puts it back to 0 */
  $$('#sliders .num').forEach(function (n) {
    var r = $('#' + n.dataset.for);
    n.addEventListener('change', function () { var v = FS.clamp(Math.round(Number(n.value) || 0), Number(r.min), Number(r.max)); n.value = v; r.value = v; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); });
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter') n.blur(); });
  });
  $$('#sliders input[type=range]').forEach(function (r) {
    fill(r);
    function zero() { r.value = r.dataset.grade === 'h' ? r.value : 0; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); }
    r.addEventListener('dblclick', zero); var lb = r.parentNode.querySelector('label'); if (lb) lb.addEventListener('dblclick', zero);
  });
  $$('[data-adj]').forEach(function (r) {
    var k = r.dataset.adj;
    r.addEventListener('input', function () { var v = Number(r.value); setRow(r, v); live(function (a) { a[k] = v; }); markSecs(); });
    r.addEventListener('change', commitAdj);
  });
  $('#tone').addEventListener('change', function () { var v = this.value; live(function (a) { a.tone = v; }); commitAdj(); });

  /* colour mixer */
  var band = 'red';
  function bandVals(a) { return (a && a.hsl && a.hsl[band]) || { h: 0, s: 0, l: 0 }; }
  function tidyHsl(a) { if (!a.hsl) return; var any = false; for (var b in a.hsl) { var v = a.hsl[b]; if (v.h || v.s || v.l) any = true; else delete a.hsl[b]; } if (!any) a.hsl = null; }
  function mixTracks() {
    var B = FS.HSL_BANDS, i = 0; for (; i < B.length; i++) if (B[i][0] === band) break;
    var c = B[i][2], h0 = B[i][3], prev = 'hsl(' + (h0 - 30) + ',75%,52%)', next = 'hsl(' + (h0 + 30) + ',75%,52%)';
    /* RTL: the minimum sits on the right, so the gradients run from right to left */
    $('#m-h').style.setProperty('--track', 'linear-gradient(to left,' + prev + ',' + c + ',' + next + ')');
    $('#m-s').style.setProperty('--track', 'linear-gradient(to left,#8a8a8a,' + c + ')');
    $('#m-l').style.setProperty('--track', 'linear-gradient(to left,#151515,' + c + ',#f4f4f4)');
    $('#mx-name').textContent = B[i][1];
  }
  $$('.mx-dot').forEach(function (d) { d.addEventListener('click', function () { band = d.dataset.band; $$('.mx-dot').forEach(function (x) { x.classList.toggle('on', x === d); }); mixTracks(); syncMix(); }); });
  $$('[data-mix]').forEach(function (r) {
    var k = r.dataset.mix;
    r.addEventListener('input', function () { var v = Number(r.value); setRow(r, v); live(function (a) { a.hsl = a.hsl || {}; var o = a.hsl[band] = a.hsl[band] || { h: 0, s: 0, l: 0 }; o[k] = v; tidyHsl(a); }); markBands(); markSecs(); });
    r.addEventListener('change', commitAdj);
  });
  function markBands() { var a = curAdj(); $$('.mx-dot').forEach(function (d) { var v = a && a.hsl && a.hsl[d.dataset.band]; d.classList.toggle('mod', !!(v && (v.h || v.s || v.l))); }); }
  function syncMix() { var v = bandVals(curAdj()); setRow($('#m-h'), v.h || 0); setRow($('#m-s'), v.s || 0); setRow($('#m-l'), v.l || 0); markBands(); }
  mixTracks();

  /* colour grading: a wheel per zone (angle = hue, distance = amount) plus precise sliders for the chosen zone */
  var zone = 'sh', wheelBase = null;
  function gradeOf(a) { return (a && a.grade) || {}; }
  function tidyGrade(a) { var g = a.grade; if (!g) return; if (!((g.sh && g.sh.s) || (g.mid && g.mid.s) || (g.hi && g.hi.s))) a.grade = null; }
  function wheelImg() {
    if (wheelBase) return wheelBase;
    var c = FS.canvas(96, 96), x = c.getContext('2d'), id = x.createImageData(96, 96), d = id.data, R = 46;
    for (var y = 0; y < 96; y++) for (var xx = 0; xx < 96; xx++) {
      var dx = xx - 48 + 0.5, dy = y - 48 + 0.5, r = Math.sqrt(dx * dx + dy * dy), i = (y * 96 + xx) * 4; if (r > R + 1) continue;
      var t = FS.hueTint(Math.atan2(-dy, dx) * 180 / Math.PI), m = Math.min(1, r / R), L = 0.5 + 0.12 * (1 - m);
      d[i] = (L + t[0] * m * 0.9) * 255; d[i + 1] = (L + t[1] * m * 0.9) * 255; d[i + 2] = (L + t[2] * m * 0.9) * 255; d[i + 3] = r > R ? (R + 1 - r) * 255 : 255;
    }
    x.putImageData(id, 0, 0); wheelBase = c; return c;
  }
  function drawWheels() {
    var g = gradeOf(curAdj());
    $$('.gw').forEach(function (f) {
      var c = f.querySelector('canvas'), x = c.getContext('2d'), v = g[f.dataset.zone] || {}, a = (v.h || 0) * Math.PI / 180, r = (v.s || 0) / 100 * 46;
      x.clearRect(0, 0, 96, 96); x.drawImage(wheelImg(), 0, 0);
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(48, 6); x.lineTo(48, 90); x.moveTo(6, 48); x.lineTo(90, 48); x.stroke();
      var px = 48 + Math.cos(a) * r, py = 48 - Math.sin(a) * r;
      x.beginPath(); x.arc(px, py, 5.5, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#111'; x.stroke();
      f.querySelector('small').textContent = v.s ? Math.round(v.h || 0) + '° · ' + Math.round(v.s) : '';
      f.classList.toggle('on', f.dataset.zone === zone);
    });
  }
  function syncGrade() { var g = gradeOf(curAdj()), v = g[zone] || {}; setRow($('#g-h'), v.h || 0); setRow($('#g-s'), v.s || 0); setRow($('#g-bal'), g.bal || 0); drawWheels(); }
  function setGrade(fn) { live(function (a) { a.grade = a.grade ? JSON.parse(JSON.stringify(a.grade)) : {}; fn(a.grade); tidyGrade(a); }); drawWheels(); markSecs(); }
  $('#g-h').style.setProperty('--track', 'linear-gradient(to left,#e5483e,#e6cf3c,#4fb64c,#3cc3c4,#3d6fe0,#d84aa6,#e5483e)');
  $$('[data-grade]').forEach(function (r) {
    var k = r.dataset.grade;
    r.addEventListener('input', function () {
      var v = Number(r.value); setRow(r, v);
      setGrade(function (g) { if (k === 'bal') g.bal = v; else { var z = g[zone] = g[zone] || { h: 0, s: 0 }; z[k] = v; if (k === 'h' && !z.s) { z.s = 25; setRow($('#g-s'), 25); } } });
    });
    r.addEventListener('change', commitAdj);
  });
  $$('.gw').forEach(function (f) {
    var c = f.querySelector('canvas'), drag = false;
    function at(e) {
      var b = c.getBoundingClientRect(), dx = (e.clientX - b.left) / b.width * 96 - 48, dy = (e.clientY - b.top) / b.height * 96 - 48;
      var h = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360, s = Math.min(100, Math.sqrt(dx * dx + dy * dy) / 46 * 100);
      setGrade(function (g) { g[zone] = { h: Math.round(h), s: Math.round(s < 4 ? 0 : s) }; }); syncGrade();
    }
    c.addEventListener('pointerdown', function (e) { zone = f.dataset.zone; drag = true; c.setPointerCapture(e.pointerId); at(e); e.preventDefault(); });
    c.addEventListener('pointermove', function (e) { if (drag) at(e); });
    c.addEventListener('pointerup', function () { if (drag) { drag = false; commitAdj(); } });
    c.addEventListener('pointercancel', function () { drag = false; });
    c.addEventListener('dblclick', function () { setGrade(function (g) { delete g[f.dataset.zone]; }); syncGrade(); commitAdj(); });
    f.addEventListener('click', function () { if (zone !== f.dataset.zone) { zone = f.dataset.zone; syncGrade(); } });
  });

  /* tone curve: drag points, click the line to add one, double-click (or drag far out) to remove it */
  var cv = $('#curve'), cvDrag = -1, cvOn = false, LIN = [[0, 0], [255, 255]];
  function curvePts() { var a = curAdj(); return a && a.curve ? a.curve.map(function (q) { return q.slice(); }) : LIN.map(function (q) { return q.slice(); }); }
  function setCurve(pts, commit) { live(function (a) { a.curve = FS.curveLUT(pts) ? pts.map(function (q) { return [Math.round(q[0]), Math.round(q[1])]; }) : null; }); drawCurve(); markSecs(); if (commit) commitAdj(); }
  FS.drawCurve = function () { drawCurve(); };
  function drawCurve() {
    if (!cv || !cv.offsetWidth) return;
    var x = cv.getContext('2d'), W = cv.width, s = W / 255, pts = curvePts(), lut = FS.curveLUT(pts), i;
    x.clearRect(0, 0, W, W); x.fillStyle = '#161618'; x.fillRect(0, 0, W, W);
    var H = FS.lumaHist; if (H) { var m = 1; for (i = 3; i < 253; i++) m = Math.max(m, H[i]); x.fillStyle = 'rgba(233,230,225,.10)'; x.beginPath(); x.moveTo(0, W); for (i = 0; i < 256; i++) x.lineTo(i * s, W - Math.min(1, H[i] / m) * W * 0.9); x.lineTo(W, W); x.fill(); }
    x.strokeStyle = '#2F2F34'; x.lineWidth = 1; x.beginPath(); for (i = 1; i < 4; i++) { x.moveTo(i * W / 4, 0); x.lineTo(i * W / 4, W); x.moveTo(0, i * W / 4); x.lineTo(W, i * W / 4); } x.stroke();
    x.strokeStyle = 'rgba(154,150,143,.45)'; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(0, W); x.lineTo(W, 0); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#E9E6E1'; x.lineWidth = 3; x.beginPath();
    for (i = 0; i <= 255; i++) { var y = lut ? lut[i] : i; if (i) x.lineTo(i * s, W - y * s); else x.moveTo(0, W - y * s); } x.stroke();
    pts.forEach(function (q, j) { x.beginPath(); x.arc(q[0] * s, W - q[1] * s, 9, 0, 7); x.fillStyle = j === cvDrag ? '#D6B77E' : '#1D1D20'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#D6B77E'; x.stroke(); });
  }
  function cvAt(e) { var b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * 255, (1 - (e.clientY - b.top) / b.height) * 255, b]; }
  function nearest(pts, q) { var best = -1, bd = 14; pts.forEach(function (p, j) { var d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; best = j; } }); return best; }
  cv.addEventListener('pointerdown', function (e) {
    var q = cvAt(e), pts = curvePts(), j = nearest(pts, q);
    if (j < 0) { var lut = FS.curveLUT(pts), yy = lut ? lut[Math.round(FS.clamp(q[0], 0, 255))] : q[0]; if (Math.abs(yy - q[1]) > 28 || pts.length >= 12) return; pts.push([q[0], yy]); pts.sort(function (a, b) { return a[0] - b[0]; }); j = nearest(pts, [q[0], yy]); }
    cvDrag = j; cvOn = true; cv.setPointerCapture(e.pointerId); setCurve(pts); e.preventDefault();
  });
  cv.addEventListener('pointermove', function (e) {
    if (cvDrag < 0) return; var q = cvAt(e), pts = curvePts(), n = pts.length, j = cvDrag;
    var out = q[0] < -30 || q[0] > 285 || q[1] < -30 || q[1] > 285;
    if (out && j > 0 && j < n - 1) { pts.splice(j, 1); cvDrag = -1; setCurve(pts); return; }
    var lo = j ? pts[j - 1][0] + 3 : 0, hi = j < n - 1 ? pts[j + 1][0] - 3 : 255;
    pts[j] = [j === 0 ? Math.min(FS.clamp(q[0], 0, 255), hi) : j === n - 1 ? Math.max(FS.clamp(q[0], 0, 255), lo) : FS.clamp(q[0], lo, hi), FS.clamp(q[1], 0, 255)];
    setCurve(pts);
  });
  cv.addEventListener('pointerup', function () { if (!cvOn) return; cvOn = false; cvDrag = -1; drawCurve(); commitAdj(); });
  cv.addEventListener('pointercancel', function () { cvOn = false; cvDrag = -1; drawCurve(); });
  cv.addEventListener('dblclick', function (e) { var pts = curvePts(), j = nearest(pts, cvAt(e)); if (j > 0 && j < pts.length - 1) { pts.splice(j, 1); setCurve(pts, true); } });
  $$('[data-curve]').forEach(function (b) { b.addEventListener('click', function () { var c = CURVES.filter(function (q) { return q[0] === b.dataset.curve; })[0]; setCurve(c[2].map(function (q) { return q.slice(); }), true); }); });

  /* per-section reset and the "changed" dot on each section header */
  function secMod(a, s) { return SEC_KEYS[s].some(function (k) { return k === 'tone' ? a.tone && a.tone !== 'none' : !!a[k]; }); }
  function markSecs() { var a = curAdj(); $$('#sliders details').forEach(function (d) { d.classList.toggle('mod', !!a && secMod(a, d.dataset.sec)); }); }
  $$('.ax-reset').forEach(function (b) { b.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation(); var s = b.dataset.reset;
    live(function (a) { SEC_KEYS[s].forEach(function (k) { a[k] = k === 'tone' ? 'none' : FS.ADJ0[k]; }); }); commitAdj();
  }); });

  $('#auto').addEventListener('click', function () { var p = FS.cur(); if (!p) return; p.doc.photo.adj = FS.autoAdjust(p); FS.batch(function (q) { q.doc.photo.adj = FS.autoAdjust(q); }); FS.changed(); FS.toast('✨ שופר אוטומטית. אפשר לכוונן בפסים.'); });
  $('#reset-adj').addEventListener('click', function () { var p = FS.cur(); if (!p) return; p.doc.photo.adj = Object.assign({}, FS.ADJ0); p.doc.photo.preset = null; FS.batch(function (q) { q.doc.photo.adj = Object.assign({}, FS.ADJ0); q.doc.photo.preset = null; }); FS.changed(); });
  var clip = null;
  $('#copy-adj').addEventListener('click', function () { var p = FS.cur(); if (!p) return; clip = JSON.parse(JSON.stringify(p.doc.photo.adj)); $('#paste-adj').disabled = false; FS.toast('העריכה הועתקה'); });
  $('#paste-adj').addEventListener('click', function () { var p = FS.cur(); if (!p || !clip) return; p.doc.photo.adj = JSON.parse(JSON.stringify(clip)); FS.batch(function (q) { q.doc.photo.adj = JSON.parse(JSON.stringify(clip)); }); FS.changed(); });
  $('#adj-all').addEventListener('click', function () { var p = FS.cur(); if (!p) return; var a = JSON.stringify(p.doc.photo.adj); S.photos.forEach(function (q) { if (q !== p) { q.doc.photo.adj = JSON.parse(a); q.cache = {}; FS.snap(q); } }); buildStrip(); FS.toast('העריכה הוחלה על ' + S.photos.length + ' תמונות'); });
  function syncAdj() {
    var p = FS.cur(); if (!p) return; var a = p.doc.photo.adj;
    $$('[data-adj]').forEach(function (r) { setRow(r, a[r.dataset.adj] || 0); }); $('#tone').value = a.tone || 'none';
    syncMix(); syncGrade(); drawCurve(); markSecs();
  }

  /* ---------- presets: adjustment values only (numbers, plus mixer / grading / curve), grouped by look ---------- */
  var CS = [[0, 0], [64, 56], [192, 202], [255, 255]], CSS2 = [[0, 0], [64, 40], [192, 218], [255, 255]];
  FS.PRESET_CATS = [['', 'הכל'], ['soft', 'עדין / טבעי'], ['wedding', 'חתונה'], ['film', 'וינטג׳ וסרט'], ['bw', 'שחור־לבן'], ['drama', 'דרמטי'], ['pop', 'צבעוני / פופ'], ['summer', 'קיץ'], ['winter', 'חורף'], ['night', 'אירוע ערב']];
  FS.PRESETS = [
    ['original', 'מקורי', {}, ''],
    /* soft / natural */
    ['natural', 'טבעי', { exposure: 4, contrast: 6, vibrance: 14, clarity: 6, curve: [[0, 0], [64, 60], [192, 198], [255, 255]] }, 'soft'],
    ['vivid', 'חי', { vibrance: 40, contrast: 15, clarity: 15, saturation: 8 }, 'soft'],
    ['clean', 'נקי ובהיר', { exposure: 10, highlights: -20, shadows: 18, whites: 10, vibrance: 12, texture: 10 }, 'soft'],
    ['skin', 'עור רך', { temp: 6, texture: -28, clarity: -10, highlights: -10, hsl: { orange: { h: 0, s: -10, l: 12 }, red: { h: 0, s: -6, l: 0 } } }, 'soft'],
    ['portra', 'פורטרה 400', { temp: 8, contrast: -6, shadows: 12, highlights: -15, fade: 8, vibrance: -6, grain: 10, hsl: { orange: { h: -6, s: -8, l: 8 }, green: { h: -30, s: -25, l: 0 }, blue: { h: -10, s: -20, l: 0 } }, grade: { sh: { h: 200, s: 12 }, hi: { h: 40, s: 14 } }, curve: [[0, 14], [70, 72], [190, 198], [255, 250]] }, 'soft'],
    ['fuji400h', 'פוג׳י 400H', { exposure: 6, temp: -6, tint: -4, contrast: -10, fade: 10, saturation: -10, hsl: { green: { h: 35, s: -15, l: 6 }, aqua: { h: -10, s: 0, l: 0 }, blue: { h: -12, s: -10, l: 0 }, orange: { h: 0, s: -10, l: 10 } }, grade: { sh: { h: 170, s: 18 }, hi: { h: 330, s: 6 } }, curve: [[0, 18], [64, 66], [192, 200], [255, 248]] }, 'soft'],
    /* wedding */
    ['wedding', 'רך לחתונות', { exposure: 10, contrast: -15, highlights: -20, fade: 15, temp: 8, vibrance: -5, clarity: -20 }, 'wedding'],
    ['airy', 'בהיר ואוורירי', { exposure: 22, contrast: -18, highlights: -30, shadows: 30, whites: 8, vibrance: -8, temp: 4, fade: 6, hsl: { orange: { h: 0, s: -10, l: 12 }, green: { h: 30, s: -35, l: 12 }, yellow: { h: 0, s: -20, l: 0 } }, curve: [[0, 22], [128, 140], [255, 252]] }, 'wedding'],
    ['ivory', 'שנהב', { exposure: 10, temp: 12, tint: 4, contrast: -10, saturation: -18, grade: { sh: { h: 30, s: 8 }, hi: { h: 45, s: 16 } }, curve: [[0, 16], [128, 134], [255, 246]] }, 'wedding'],
    ['blush', 'ורוד עדין', { exposure: 12, tint: 12, contrast: -12, highlights: -15, shadows: 15, vibrance: -6, hsl: { red: { h: 0, s: -10, l: 8 }, orange: { h: 0, s: 0, l: 10 } }, grade: { mid: { h: 20, s: 6 }, hi: { h: 345, s: 16 } } }, 'wedding'],
    ['romantic', 'רומנטי', { temp: 10, contrast: -8, highlights: -15, clarity: -18, texture: -15, vignette: 18, grade: { sh: { h: 20, s: 10 }, hi: { h: 40, s: 12 } }, curve: [[0, 20], [64, 66], [192, 200], [255, 248]] }, 'wedding'],
    ['classic', 'חתונה קלאסית', { exposure: 6, contrast: 12, highlights: -25, shadows: 15, vibrance: 10, clarity: 8, temp: 4, hsl: { orange: { h: 0, s: 0, l: 6 } } }, 'wedding'],
    ['pastel', 'פסטל', { exposure: 15, contrast: -30, saturation: -20, fade: 30, tint: 8 }, 'wedding'],
    /* vintage and film */
    ['vintage', 'וינטג׳', { fade: 40, saturation: -25, temp: 20, grain: 25, vignette: 30, tone: 'sepia', mono: 15 }, 'film'],
    ['film', 'פילם', { fade: 25, grain: 30, tone: 'teal', contrast: 10, saturation: -10 }, 'film'],
    ['kodakgold', 'קודאק גולד', { temp: 18, tint: -4, contrast: 10, vibrance: 10, grain: 18, hsl: { yellow: { h: -10, s: 15, l: 0 }, green: { h: -20, s: -10, l: 0 }, blue: { h: 0, s: -15, l: 0 }, red: { h: 0, s: 8, l: 0 } }, grade: { sh: { h: 30, s: 10 }, hi: { h: 45, s: 14 } }, curve: [[0, 12], [64, 60], [192, 206], [255, 248]] }, 'film'],
    ['cross', 'קרוס־פרוסס', { contrast: 18, saturation: 12, hsl: { red: { h: 10, s: 0, l: 0 }, green: { h: -15, s: 20, l: 0 } }, grade: { sh: { h: 200, s: 40 }, mid: { h: 120, s: 8 }, hi: { h: 60, s: 40 } }, curve: [[0, 10], [64, 50], [192, 214], [255, 245]] }, 'film'],
    ['matte', 'מט', { fade: 45, contrast: -10, blacks: 20 }, 'film'],
    ['fadedmatte', 'מט דהוי', { fade: 20, contrast: -14, saturation: -22, grain: 12, grade: { sh: { h: 210, s: 10 } }, curve: [[0, 46], [60, 70], [190, 190], [255, 232]] }, 'film'],
    ['polaroid', 'פולארויד', { exposure: 8, temp: 10, tint: 6, contrast: -12, fade: 22, saturation: -12, vignette: 22, grade: { sh: { h: 180, s: 16 }, hi: { h: 50, s: 20 } }, curve: [[0, 30], [128, 138], [255, 236]] }, 'film'],
    ['retro70', 'שנות ה־70', { temp: 24, tint: 6, saturation: -10, fade: 18, grain: 24, hsl: { green: { h: -40, s: -30, l: 0 }, blue: { h: -30, s: -40, l: 0 }, orange: { h: 0, s: 10, l: 0 } }, grade: { sh: { h: 30, s: 18 }, hi: { h: 50, s: 18 } }, curve: [[0, 24], [128, 132], [255, 236]] }, 'film'],
    ['sepia', 'ספיה', { mono: 70, tone: 'sepia', fade: 15 }, 'film'],
    /* black and white */
    ['bw', 'שחור־לבן', { mono: 100, contrast: 25, clarity: 20 }, 'bw'],
    ['noir', 'נואר', { mono: 100, contrast: 60, blacks: -30, vignette: 45, grain: 18 }, 'bw'],
    ['bwhigh', 'ש״ל חזק', { mono: 100, contrast: 40, clarity: 25, whites: 15, blacks: -20, texture: 12, curve: CSS2 }, 'bw'],
    ['bwsoft', 'ש״ל רך', { mono: 100, contrast: -12, fade: 14, highlights: -20, shadows: 20, curve: [[0, 22], [128, 130], [255, 246]] }, 'bw'],
    ['bwwarm', 'ש״ל חם', { mono: 100, contrast: 15, grade: { sh: { h: 30, s: 10 }, hi: { h: 40, s: 22 } }, curve: CS }, 'bw'],
    ['selenium', 'סלניום', { mono: 100, contrast: 20, blacks: -10, grade: { sh: { h: 230, s: 18 }, hi: { h: 40, s: 6 } } }, 'bw'],
    ['bwfilm', 'ש״ל פילם', { mono: 100, contrast: 22, grain: 35, fade: 10, vignette: 20, curve: [[0, 14], [64, 48], [192, 214], [255, 248]] }, 'bw'],
    ['bwred', 'ש״ל פילטר אדום', { mono: 100, contrast: 20, hsl: { blue: { h: 0, s: 0, l: -45 }, aqua: { h: 0, s: 0, l: -30 }, red: { h: 0, s: 0, l: 20 }, orange: { h: 0, s: 0, l: 18 } } }, 'bw'],
    /* dramatic */
    ['drama', 'דרמטי', { contrast: 35, clarity: 45, highlights: -40, shadows: 30, vignette: 30, saturation: -10 }, 'drama'],
    ['hdr', 'HDR', { highlights: -70, shadows: 70, clarity: 60, vibrance: 30, sharpen: 30 }, 'drama'],
    ['cinema', 'קולנועי', { tone: 'teal', contrast: 25, saturation: -15, vignette: 25, blacks: -15 }, 'drama'],
    ['tealorange', 'טורקיז וכתום', { contrast: 18, vibrance: 10, hsl: { orange: { h: -5, s: 10, l: 6 }, yellow: { h: -20, s: 0, l: 0 }, green: { h: 60, s: -30, l: 0 }, aqua: { h: 10, s: 10, l: 0 }, blue: { h: -15, s: 10, l: 0 } }, grade: { sh: { h: 195, s: 35 }, hi: { h: 35, s: 30 }, bal: -10 }, curve: [[0, 8], [64, 52], [192, 206], [255, 250]] }, 'drama'],
    ['moody', 'כהה ומאופק', { exposure: -12, contrast: 14, highlights: -30, shadows: -6, saturation: -25, vignette: 30, hsl: { green: { h: 20, s: -40, l: -20 }, blue: { h: 0, s: -30, l: -10 }, orange: { h: 0, s: -6, l: 0 } }, grade: { sh: { h: 210, s: 20 }, hi: { h: 35, s: 10 } }, curve: [[0, 18], [80, 70], [190, 190], [255, 236]] }, 'drama'],
    ['bleach', 'ביטול הלבנה', { contrast: 35, saturation: -45, clarity: 25, texture: 10, whites: 10, blacks: -10, curve: CSS2 }, 'drama'],
    ['epic', 'אפי', { dehaze: 30, contrast: 20, clarity: 30, highlights: -35, shadows: 20, vibrance: 12, vignette: 25, grade: { sh: { h: 215, s: 15 }, hi: { h: 40, s: 12 } } }, 'drama'],
    /* colourful / pop */
    ['pop', 'פופ', { vibrance: 40, saturation: 15, contrast: 20, clarity: 10, curve: CS, hsl: { blue: { h: 0, s: 20, l: 0 }, red: { h: 0, s: 10, l: 0 } } }, 'pop'],
    ['candy', 'סוכרייה', { exposure: 8, tint: 8, saturation: 20, contrast: -6, hsl: { red: { h: -10, s: 10, l: 0 }, magenta: { h: 0, s: 20, l: 0 }, aqua: { h: 0, s: 20, l: 0 }, yellow: { h: 0, s: -10, l: 0 } }, grade: { sh: { h: 200, s: 12 }, hi: { h: 330, s: 14 } } }, 'pop'],
    ['tropical', 'טרופי', { vibrance: 35, temp: 6, contrast: 12, dehaze: 10, hsl: { green: { h: 20, s: 20, l: 0 }, aqua: { h: 0, s: 30, l: 0 }, blue: { h: -10, s: 20, l: 0 } } }, 'pop'],
    ['retropop', 'רטרו פופ', { saturation: 25, contrast: 25, fade: 10, hsl: { orange: { h: -10, s: 0, l: 0 } }, grade: { sh: { h: 250, s: 20 }, hi: { h: 55, s: 25 } } }, 'pop'],
    ['food', 'אוכל', { exposure: 8, temp: 12, vibrance: 35, clarity: 20, sharpen: 25 }, 'pop'],
    /* summer */
    ['golden', 'שעת זהב', { temp: 35, vibrance: 20, highlights: -15, shadows: 15, tone: 'gold' }, 'summer'],
    ['summer', 'קיץ', { exposure: 12, vibrance: 35, temp: 18, tint: 5, shadows: 20 }, 'summer'],
    ['beach', 'חוף', { exposure: 12, temp: 4, vibrance: 25, highlights: -20, shadows: 10, whites: 8, dehaze: 8, hsl: { aqua: { h: -5, s: 25, l: 6 }, blue: { h: -10, s: 20, l: 6 }, yellow: { h: 0, s: -8, l: 0 } } }, 'summer'],
    ['sunset', 'שקיעה', { temp: 30, tint: 8, vibrance: 20, contrast: 12, highlights: -25, vignette: 15, grade: { sh: { h: 280, s: 16 }, hi: { h: 30, s: 30 } } }, 'summer'],
    ['goldsoft', 'זהוב רך', { temp: 22, exposure: 6, contrast: -6, fade: 8, hsl: { orange: { h: 0, s: 0, l: 8 }, green: { h: -25, s: -15, l: 0 } }, grade: { mid: { h: 30, s: 10 }, hi: { h: 42, s: 28 } } }, 'summer'],
    /* winter */
    ['cool', 'קר', { temp: -30, tint: -5, contrast: 10 }, 'winter'],
    ['winter', 'חורף', { temp: -22, tint: -2, exposure: 8, saturation: -20, highlights: -15, whites: 10, hsl: { orange: { h: 0, s: -15, l: 0 }, blue: { h: 0, s: 10, l: 8 } }, grade: { sh: { h: 215, s: 20 }, hi: { h: 200, s: 10 } }, curve: [[0, 12], [128, 134], [255, 252]] }, 'winter'],
    ['frost', 'כפור', { temp: -30, exposure: 12, contrast: -8, saturation: -35, fade: 12, clarity: 10, grade: { sh: { h: 200, s: 16 }, mid: { h: 210, s: 8 } } }, 'winter'],
    ['nordic', 'נורדי', { temp: -10, saturation: -25, contrast: 6, highlights: -20, shadows: 15, hsl: { green: { h: 20, s: -30, l: 0 }, yellow: { h: 0, s: -30, l: 0 } }, curve: [[0, 16], [128, 128], [255, 246]] }, 'winter'],
    ['snow', 'שלג בהיר', { exposure: 20, whites: 20, temp: -12, contrast: -6, highlights: -10, vibrance: -10 }, 'winter'],
    /* evening events */
    ['night', 'לילה', { temp: -40, exposure: -15, contrast: 20, vignette: 40, tone: 'cool' }, 'night'],
    ['neon', 'ניאון', { contrast: 22, vibrance: 30, saturation: 10, dehaze: 12, vignette: 20, blacks: -10, hsl: { magenta: { h: 0, s: 30, l: 0 }, purple: { h: 10, s: 25, l: 0 }, blue: { h: 0, s: 25, l: 0 }, aqua: { h: -10, s: 30, l: 0 }, orange: { h: 0, s: -10, l: 0 } }, grade: { sh: { h: 265, s: 30 }, hi: { h: 320, s: 16 } } }, 'night'],
    ['club', 'מועדון', { contrast: 28, clarity: 15, saturation: 18, vignette: 30, blacks: -15, grade: { sh: { h: 240, s: 30 }, hi: { h: 300, s: 20 } } }, 'night'],
    ['candle', 'אור נרות', { temp: 28, tint: 4, exposure: 6, highlights: -25, shadows: 20, contrast: -4, vignette: 22, texture: -10, grade: { sh: { h: 25, s: 16 }, hi: { h: 40, s: 20 } } }, 'night'],
    ['evening', 'זוהר ערב', { exposure: 10, shadows: 30, highlights: -30, temp: 10, vibrance: 12, clarity: 8, dehaze: 8, grade: { sh: { h: 220, s: 12 }, hi: { h: 40, s: 14 } } }, 'night'],
    ['flash', 'תיקון פלאש', { highlights: -40, whites: -10, shadows: 25, temp: 8, texture: -15, clarity: -6, hsl: { orange: { h: 0, s: -12, l: 6 }, red: { h: 0, s: -8, l: 0 } } }, 'night']
  ];
  /* a preset at strength k (0..1.5): numbers scale, the mixer and grading amounts scale, the curve bends towards straight */
  function presetAdj(vals, k) {
    var a = Object.assign({}, FS.ADJ0), key, b;
    for (key in vals) {
      var v = vals[key];
      if (key === 'tone') a.tone = k > 0.3 ? v : 'none';
      else if (key === 'hsl' && v) { a.hsl = {}; for (b in v) a.hsl[b] = { h: Math.round((v[b].h || 0) * k), s: Math.round((v[b].s || 0) * k), l: Math.round((v[b].l || 0) * k) }; }
      else if (key === 'grade' && v) { a.grade = { bal: Math.round((v.bal || 0) * k) }; ZONES.forEach(function (z) { if (v[z[0]]) a.grade[z[0]] = { h: v[z[0]].h || 0, s: Math.round(FS.clamp((v[z[0]].s || 0) * k, 0, 100)) }; }); }
      else if (key === 'curve' && v) a.curve = k ? v.map(function (q) { return [q[0], Math.round(FS.clamp(q[0] + (q[1] - q[0]) * k, 0, 255))]; }) : null;
      else if (typeof v === 'number') a[key] = Math.round(v * k);
    }
    if (k <= 0) { a.hsl = a.grade = a.curve = null; }
    return a;
  }
  FS.presetAdj = presetAdj;
  function myPresets() { try { return JSON.parse(localStorage.getItem('frame-studio-presets') || '[]'); } catch (e) { return []; } }
  /* thumbnails: the photo is scaled down once (kept per photo), each look is drawn from that copy and kept until the photo changes */
  var TB = { src: null, data: null, w: 0, h: 0, tiles: {} };
  function thumbBase(p) {
    if (TB.src === p.src && TB.data) return TB;
    var im = FS.img(p.src), k = 132 / Math.max(im.naturalWidth, im.naturalHeight), c = FS.canvas(Math.max(1, Math.round(im.naturalWidth * k)), Math.max(1, Math.round(im.naturalHeight * k))), x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
    TB = { src: p.src, data: x.getImageData(0, 0, c.width, c.height), w: c.width, h: c.height, tiles: {} }; return TB;
  }
  function presetThumb(p, adj) {
    var t = thumbBase(p), c = FS.canvas(t.w, t.h), x = c.getContext('2d'), id = new ImageData(new Uint8ClampedArray(t.data.data), t.w, t.h);
    FS.adjustPixels(id.data, t.w, t.h, adj, true); x.putImageData(id, 0, 0); return c;
  }
  FS.presetThumb = presetThumb;
  function presetBtn(p, id, name, vals, mine, cat) {
    var b = document.createElement('button'); b.className = 'tile' + (p.doc.photo.preset === id ? ' on' : ''); b.dataset.cat = cat || '';
    var t = thumbBase(p), key = id + '|' + JSON.stringify(vals), c = TB.tiles[key];
    if (!c) { c = FS.canvas(t.w, t.h); c._todo = vals; TB.tiles[key] = c; }
    b.appendChild(c); var s = document.createElement('span'); s.textContent = name; b.appendChild(s);
    b.addEventListener('click', function () { var k = Number($('#fstr').value) / 100; p.doc.photo.adj = presetAdj(vals, k); p.doc.photo.preset = id; FS.batch(function (q) { q.doc.photo.adj = presetAdj(vals, k); q.doc.photo.preset = id; }); FS.changed(); buildPresetsMarks(); });
    if (mine) { var x = document.createElement('i'); x.className = 'x'; x.textContent = '✕'; x.addEventListener('click', function (e) { e.stopPropagation(); localStorage.setItem('frame-studio-presets', JSON.stringify(myPresets().filter(function (q) { return q.id !== id; }))); buildPresets(); }); b.appendChild(x); }
    b.dataset.id = id; return b;
  }
  /* the looks are drawn a few at a time, the visible category first, so the tab opens at once even on a slow computer */
  var drawT = null;
  function drawPending() {
    clearTimeout(drawT); var p = FS.cur(); if (!p) return;
    var list = $$('#presets .tile:not([hidden]) canvas, #my-presets .tile canvas, #presets .tile canvas').filter(function (c) { return c._todo; }), t0 = Date.now();
    while (list.length && Date.now() - t0 < 24) { var c = list.shift(), id = new ImageData(new Uint8ClampedArray(TB.data.data), TB.w, TB.h); FS.adjustPixels(id.data, TB.w, TB.h, presetAdj(c._todo, 1), true); c.getContext('2d').putImageData(id, 0, 0); c._todo = null; }
    if (list.length) drawT = setTimeout(drawPending, 16);
  }
  function buildPresetsMarks() { var p = FS.cur(); $$('#presets .tile, #my-presets .tile').forEach(function (b) { b.classList.toggle('on', !!p && b.dataset.id === p.doc.photo.preset); }); }
  var pcat = FS.prefs.presetCat || '';
  function showCat() { $$('#preset-cats button').forEach(function (b) { b.classList.toggle('on', b.dataset.cat === pcat); }); $$('#presets .tile').forEach(function (b) { b.hidden = !!pcat && b.dataset.cat !== pcat && b.dataset.cat !== ''; }); }
  $('#preset-cats').innerHTML = FS.PRESET_CATS.map(function (c) { return '<button type="button" data-cat="' + c[0] + '">' + c[1] + '</button>'; }).join('');
  $$('#preset-cats button').forEach(function (b) { b.addEventListener('click', function () { pcat = b.dataset.cat; FS.prefs.presetCat = pcat; FS.savePrefs(); showCat(); drawPending(); }); });
  function buildPresets() {
    var p = FS.cur(), g = $('#presets'), m = $('#my-presets'); g.innerHTML = ''; m.innerHTML = '';
    if (!p || !FS.img(p.src)) { g.innerHTML = '<p class="empty">בוחרים תמונה קודם.</p>'; return; }
    FS.PRESETS.forEach(function (q) { g.appendChild(presetBtn(p, q[0], q[1], q[2], false, q[3])); });
    myPresets().forEach(function (q) { m.appendChild(presetBtn(p, q.id, q.name, q.adj, true)); });
    showCat(); drawPending();
  }
  $('#fstr').addEventListener('input', function () {
    $('#o-fstr').textContent = this.value + '%'; var p = FS.cur(); if (!p || !p.doc.photo.preset) return;
    var q = FS.PRESETS.filter(function (x) { return x[0] === p.doc.photo.preset; })[0], vals = q ? q[2] : (myPresets().filter(function (x) { return x.id === p.doc.photo.preset; })[0] || {}).adj;
    if (vals) { p.doc.photo.adj = presetAdj(vals, this.value / 100); FS.render(true); FS.commitSoon(); syncAdj(); }
  });
  $('#save-preset').addEventListener('click', function () {
    var p = FS.cur(); if (!p) return; var name = prompt('שם לפילטר:', 'הפילטר שלי'); if (!name) return;
    var a = {}; for (var k in p.doc.photo.adj) if (p.doc.photo.adj[k] && p.doc.photo.adj[k] !== 'none') a[k] = JSON.parse(JSON.stringify(p.doc.photo.adj[k]));
    var list = myPresets(); list.push({ id: 'm' + FS.uid(), name: name, adj: a }); localStorage.setItem('frame-studio-presets', JSON.stringify(list)); buildPresets(); FS.toast('הפילטר נשמר');
  });

  /* ---------- frames panel ---------- */
  function frameTile(name, canvasOrImg, on, onClick, onDel) {
    var b = document.createElement('button'); b.className = 'tile frame' + (on ? ' on' : ''); b.appendChild(canvasOrImg);
    var s = document.createElement('span'); s.textContent = name; b.appendChild(s); b.addEventListener('click', onClick);
    if (onDel) { var x = document.createElement('i'); x.className = 'x'; x.textContent = '✕'; x.title = 'מחיקה'; x.addEventListener('click', function (e) { e.stopPropagation(); onDel(); }); b.appendChild(x); }
    return b;
  }
  /* frame tiles: each preview is drawn on a small copy of the page (a frame drawn at full print size for a 130px tile was
     the slow part), kept until the photo, the page size or the frame changes, and drawn a few at a time so the tab opens
     at once */
  var FP = {}, fpQueue = [], fpBusy = false;
  function fpKey(p, ref) { return (p ? p.id + '|' + p.src + '|' + p.doc.w + 'x' + p.doc.h + '|' + JSON.stringify(p.doc.photo.adj) + '|' + JSON.stringify(p.doc.photo.style || 0) : '-') + '|' + JSON.stringify(ref); }
  function framePreview(p, ref) {
    var d = p ? p.doc : { w: 1200, h: 1800 }, k = 130 / Math.max(d.w, d.h), c = FS.canvas(d.w * k, d.h * k), x = c.getContext('2d');
    if (p) {
      var small = 320 / Math.max(d.w, d.h), im = FS.img(p.src);
      var tmp = { src: p.src, doc: JSON.parse(JSON.stringify(p.doc)), cache: {}, mask: p.mask, maskV: p.maskV };
      tmp.doc.layers = []; if (small < 1 && im) FS.applyFormat(tmp.doc, 'custom', im, d.w * small, d.h * small);
      FS.setFrame(tmp, ref, { quiet: true }); FS.draw(x, tmp, { scale: c.width / tmp.doc.w, max: 300, fast: true });
    }
    else { x.fillStyle = '#556'; x.fillRect(0, 0, c.width, c.height); var dd = { w: d.w, h: d.h, frame: ref, layers: [] }; x.save(); x.scale(k, k); FS.drawFrame(x, dd); x.restore(); }
    return c;
  }
  function tileCanvas(p, ref) {
    var key = fpKey(p, ref), d = p ? p.doc : { w: 1200, h: 1800 }, k = 130 / Math.max(d.w, d.h), c = FS.canvas(d.w * k, d.h * k);
    if (FP[key]) c.getContext('2d').drawImage(FP[key], 0, 0);
    else { c.classList.add('pending'); fpQueue.push({ c: c, p: p, ref: ref, key: key }); fpRun(); }
    return c;
  }
  function fpRun() {
    if (fpBusy) return; fpBusy = true;
    (window.requestIdleCallback || function (f) { return setTimeout(f, 16); })(function () {
      fpBusy = false; var t0 = Date.now();
      while (fpQueue.length && Date.now() - t0 < 30) {
        var j = fpQueue.shift(); if (!j.c.isConnected) continue;
        try { FP[j.key] = FP[j.key] || framePreview(j.p, j.ref); j.c.getContext('2d').drawImage(FP[j.key], 0, 0); } catch (e) { /* skipped */ }
        j.c.classList.remove('pending');
      }
      if (fpQueue.length) fpRun();
    });
  }
  function buildFrames() {
    var p = FS.cur(), g = $('#gen-frames'), u = $('#user-frames'), cur = p && p.doc.frame;
    fpQueue = [];
    g.innerHTML = '';
    FS.GEN_FRAMES.filter(function (f) { return f.base; }).forEach(function (f) {
      g.appendChild(frameTile(f.name, tileCanvas(p, { kind: 'gen', id: f.id }), cur && cur.kind === 'gen' && cur.id === f.id, function () { useFrame({ kind: 'gen', id: f.id, color: f.color, thick: 1, opacity: 1 }); }));
    });
    var ids = Object.keys(FS.USER_FRAMES);
    u.innerHTML = ids.length ? '' : '<p class="empty">עדיין אין. מוסיפים PNG עם חלון שקוף, או שומרים מסגרת מעוצבת מלשונית "שמירה".</p>';
    ids.forEach(function (id) {
      var f = FS.USER_FRAMES[id];
      u.appendChild(frameTile(f.name + (f.solid ? ' ⚠' : ''), tileCanvas(p, { kind: 'png', id: id }), cur && cur.kind === 'png' && cur.id === id,
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
    list = list.filter(function (f) { return /^image\//.test(f.type) || /\.(png|webp|jpe?g|gif)$/i.test(f.name); });
    if (!list.length) return FS.toast('מסגרת צריכה להיות קובץ תמונה: PNG עם חלון שקוף (הכי טוב), WEBP או JPG.', 6000);
    FS.busy('מוסיף מסגרת…');
    /* one after another, so a big frame doesn't hold the page */
    var fr = [], chain = Promise.resolve();
    list.forEach(function (f, i) { chain = chain.then(function () {
      if (list.length > 1) FS.busy('מוסיף מסגרות… ' + (i + 1) + ' מתוך ' + list.length);
      return FS.fileToDataURL(f).then(function (src) { return FS.addUserFrame(src, f.name.replace(/\.[^.]+$/, '')); }).then(function (u) { fr.push(u); });
    }); });
    chain.then(function () {
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
