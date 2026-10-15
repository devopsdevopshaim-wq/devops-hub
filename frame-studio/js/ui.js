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
  $('#dlg').addEventListener('close', function () { FS.emit('dialog-closed'); $('#dlg-body').innerHTML = ''; });
  FS.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- render ---------- */
  var pending = false, fastUntil = 0, idleT = null;
  FS.render = function (fast) {
    if (fast) { fastUntil = Date.now() + 220; clearTimeout(idleT); idleT = setTimeout(function () { FS.render(); }, 260); }
    if (pending) return; pending = true;
    requestAnimationFrame(function () { pending = false; paint(); });
  };
  FS.viewScale = 1;
  function paint() {
    var p = FS.cur();
    $('#welcome').hidden = !!p; view.hidden = !p;
    if (!p) return;
    var d = p.doc, box = wrap.getBoundingClientRect(), pad = 28;
    var sc = Math.min((box.width - pad) / d.w, (box.height - pad) / d.h); if (!(sc > 0)) sc = 0.2;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.round(d.w * sc * dpr), ch = Math.round(d.h * sc * dpr);
    if (view.width !== cw || view.height !== ch) { view.width = cw; view.height = ch; }
    view.style.width = Math.round(d.w * sc) + 'px'; view.style.height = Math.round(d.h * sc) + 'px';
    FS.viewScale = sc;
    var fast = Date.now() < fastUntil, max = Math.min(2000, Math.max(700, Math.round(Math.max(d.w, d.h) * sc * dpr * 1.3)));
    FS.draw(vctx, p, { scale: sc * dpr, max: fast ? Math.min(max, 900) : max, fast: fast, sel: S.sel });
  }
  window.addEventListener('resize', function () { FS.render(); });

  FS.on('doc', function () { FS.render(); syncPanels(); refreshThumb(); });
  FS.on('history', function () { var p = FS.cur(); $('#undo').disabled = !p || p.undo.length < 2; $('#redo').disabled = !p || !p.redo.length; });
  /* a change that should be undoable */
  FS.changed = function (fast) { var p = FS.cur(); if (!p) return; FS.render(fast); if (!fast) { FS.snap(p); syncPanels(); refreshThumb(); } };
  var commitT = null;
  FS.commitSoon = function () { clearTimeout(commitT); commitT = setTimeout(function () { var p = FS.cur(); if (p) { FS.snap(p); refreshThumb(); } }, 450); };

  /* ---------- tabs ---------- */
  function openTab(name) {
    $$('.tools [role=tab]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false'); });
    $$('[data-pane]').forEach(function (s) { s.hidden = s.dataset.pane !== name; });
    FS.prefs.tab = name; FS.savePrefs();
    if (name === 'filters') buildPresets();
    if (name === 'frames') buildFrames();
    if (name === 'text') syncLayers();
  }
  FS.openTab = openTab;
  $$('.tools [role=tab]').forEach(function (b) { b.addEventListener('click', function () { openTab(b.dataset.tab); }); });

  /* ---------- formats ---------- */
  function fillFormats(sel, withOrig) {
    sel.innerHTML = FS.FORMATS.filter(function (f) { return withOrig || f.id !== 'orig'; }).map(function (f) { return '<option value="' + f.id + '">' + f.name + '</option>'; }).join('');
  }
  fillFormats($('#fmt'), true); fillFormats($('#fmt-new'), true);
  $('#fmt').insertAdjacentHTML('beforeend', '<option value="custom" hidden>לפי המסגרת</option>');
  $('#fmt-new').value = FS.prefs.fmt || 'orig';
  $('#fmt-new').addEventListener('change', function () { FS.prefs.fmt = this.value; FS.savePrefs(); });
  $('#frame-all').checked = !!FS.prefs.frameForAll;
  $('#frame-all').addEventListener('change', function () { FS.prefs.frameForAll = this.checked; FS.savePrefs(); });
  $('#fmt').addEventListener('change', function () {
    var p = FS.cur(); if (!p) return;
    var d = p.doc, oldW = d.w, oldH = d.h;
    FS.applyFormat(d, this.value, FS.img(p.src));
    d.layers.forEach(function (L) { L.x = L.x / oldW * d.w; L.y = L.y / oldH * d.h; });
    FS.changed();
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
  function buildStrip() {
    var st = $('#strip');
    st.innerHTML = '';
    S.photos.forEach(function (p, i) {
      var b = document.createElement('button'); b.className = 'th' + (i === S.cur ? ' on' : ''); b.title = p.name;
      b.appendChild(thumbOf(p, 120));
      var x = document.createElement('span'); x.className = 'x'; x.textContent = '✕'; x.title = 'הסרה';
      x.addEventListener('click', function (e) { e.stopPropagation(); removePhoto(i); });
      b.appendChild(x);
      b.addEventListener('click', function () { select(i); });
      st.appendChild(b);
    });
    if (FS.markStrip) FS.markStrip();
    if (S.photos.length) { var add = document.createElement('label'); add.className = 'th add'; add.innerHTML = '＋<input type="file" accept="image/*" multiple hidden>'; add.querySelector('input').addEventListener('change', function () { addFiles(this.files); }); st.appendChild(add); }
  }
  FS.buildStrip = buildStrip;
  var thumbT = null;
  function refreshThumb() {
    clearTimeout(thumbT);
    thumbT = setTimeout(function () { var b = $$('#strip .th')[S.cur], p = FS.cur(); if (b && p) { var old = b.querySelector('canvas'); if (old) b.replaceChild(thumbOf(p, 120), old); } }, 300);
  }
  function removePhoto(i) {
    S.photos.splice(i, 1);
    if (S.cur >= S.photos.length) S.cur = S.photos.length - 1;
    S.sel = null; buildStrip(); FS.emit('doc'); FS.emit('history');
  }
  function select(i) {
    S.cur = i; S.sel = null;
    var p = FS.cur(); if (p && !p.undo.length) FS.snap(p);
    buildStrip(); FS.emit('doc'); FS.emit('history');
    if ($('[data-pane=filters]').hidden === false) buildPresets();
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
    if (drag && Object.keys(ptrs).length === 0) { drag = null; FS.changed(); if (S.sel) fillLayerEditor(); }
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
  $('#page-bg').addEventListener('input', function () { var p = FS.cur(); if (!p) return; p.doc.bg = this.value; FS.render(); FS.commitSoon(); });

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
    r.addEventListener('change', function () { FS.changed(); });
    r.addEventListener('dblclick', function () { r.value = 0; r.dispatchEvent(new Event('input')); FS.changed(); });
  });
  $('#tone').addEventListener('change', function () { var p = FS.cur(); if (!p) return; p.doc.photo.adj.tone = this.value; FS.changed(); });
  $('#auto').addEventListener('click', function () { var p = FS.cur(); if (!p) return; p.doc.photo.adj = FS.autoAdjust(p); FS.changed(); FS.toast('✨ שופר אוטומטית. אפשר לכוונן בפסים.'); });
  $('#reset-adj').addEventListener('click', function () { var p = FS.cur(); if (!p) return; p.doc.photo.adj = Object.assign({}, FS.ADJ0); p.doc.photo.preset = null; FS.changed(); });
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
    b.addEventListener('click', function () { var k = Number($('#fstr').value) / 100; p.doc.photo.adj = presetAdj(vals, k); p.doc.photo.preset = id; FS.changed(); buildPresetsMarks(); });
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
    FS.GEN_FRAMES.forEach(function (f) {
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
  function useFrame(ref) { var p = FS.cur(); if (!p) { FS.toast('בוחרים תמונה קודם'); return; } FS.setFrame(p, ref); $('#fmt').value = p.doc.fmt; FS.changed(); buildFrames(); }
  FS.useFrame = useFrame;
  function syncFrameOpts() {
    var p = FS.cur(), f = p && p.doc.frame; $('#frame-opts').hidden = !f; if (!f) return;
    $$('.gen-only').forEach(function (e) { e.hidden = f.kind !== 'gen'; }); $$('.png-only').forEach(function (e) { e.hidden = f.kind !== 'png'; });
    if (f.kind === 'gen') { $('#frame-color').value = f.color || '#ffffff'; $('#frame-thick').value = Math.round((f.thick || 1) * 100); $('#o-thick').textContent = $('#frame-thick').value + '%'; }
    else { $('#frame-tint').value = f.tint || '#d4a843'; $('#frame-tint-amt').value = Math.round((f.tintAmt || 0) * 100); $('#frame-clip').checked = !!f.clip; }
    $('#frame-op').value = Math.round((f.opacity == null ? 1 : f.opacity) * 100); $('#o-fop').textContent = $('#frame-op').value + '%';
  }
  function frameProp(fn, refit) { return function () { var p = FS.cur(); if (!p || !p.doc.frame) return; fn(p.doc.frame, this); if (refit) FS.fitPhoto(p.doc, FS.img(p.src)); FS.render(true); FS.commitSoon(); syncFrameOpts(); }; }
  $('#frame-color').addEventListener('input', frameProp(function (f, el) { f.color = el.value; }));
  $('#frame-thick').addEventListener('input', frameProp(function (f, el) { f.thick = el.value / 100; }, true));
  $('#frame-tint').addEventListener('input', frameProp(function (f, el) { f.tint = el.value; if (!f.tintAmt) f.tintAmt = 0.6; }));
  $('#frame-tint-amt').addEventListener('input', frameProp(function (f, el) { f.tintAmt = el.value / 100; }));
  $('#frame-clip').addEventListener('change', frameProp(function (f, el) { f.clip = el.checked; }));
  $('#frame-op').addEventListener('input', frameProp(function (f, el) { f.opacity = el.value / 100; }));
  $('#frame-none').addEventListener('click', function () { var p = FS.cur(); if (!p) return; FS.setFrame(p, null); FS.changed(); buildFrames(); });
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
    d.layers.push(L); S.sel = L; FS.changed(); openLayerEditor(); return L;
  }
  FS.addLayer = addLayer;
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
    var t = $('#le-text'); if (t) t.addEventListener('input', function () { L.text = t.value; FS.render(); FS.commitSoon(); syncLayers(); });
    $$('[data-k]', box).forEach(function (el) {
      el.addEventListener('input', function () {
        var v = el.type === 'range' ? Number(el.value) : el.value;
        if (el.dataset.k === 'grad') { var cb = $('[data-tg2=grad]', box); cb.checked = true; }
        L[el.dataset.k] = v; var o = el.parentNode.querySelector('output'); if (o) o.textContent = Math.round(v * 100) / 100;
        if (el.dataset.k === 'font' && document.fonts) document.fonts.load('700 40px "' + v + '"').then(function () { FS.render(); });
        FS.render(true); FS.commitSoon();
      });
    });
    var g2 = $('[data-tg2=grad]', box); if (g2) g2.addEventListener('change', function () { L.grad = g2.checked ? $('[data-k=grad]', box).value : null; FS.changed(); });
    $$('[data-tg]', box).forEach(function (b) { b.addEventListener('click', function () {
      var k = b.dataset.tg; if (k === 'bold') L.weight = L.weight >= 700 ? 400 : 800; else L[k] = !L[k];
      b.classList.toggle('on'); FS.changed(); }); });
    $$('[data-la]', box).forEach(function (b) { b.addEventListener('click', function () { layerAct(b.dataset.la); }); });
  }
  function layerAct(a) {
    var p = FS.cur(), L = S.sel; if (!p || !L) return; var arr = p.doc.layers, i = arr.indexOf(L);
    if (a === 'center') { L.x = p.doc.w / 2; L.y = p.doc.h / 2; }
    else if (a === 'up' && i < arr.length - 1) { arr.splice(i, 1); arr.splice(i + 1, 0, L); }
    else if (a === 'down' && i > 0) { arr.splice(i, 1); arr.splice(i - 1, 0, L); }
    else if (a === 'dup') return dupLayer();
    else if (a === 'del') return delLayer();
    else if (a === 'lock') { L.locked = true; S.sel = null; closeLayerEditor(); FS.toast('השכבה ננעלה. פותחים אותה ברשימת השכבות.'); }
    FS.changed();
  }
  function dupLayer() { var p = FS.cur(), L = S.sel; var c = JSON.parse(JSON.stringify(L)); c.id = FS.uid(); c.x += 30; c.y += 30; delete c.frameText; p.doc.layers.push(c); S.sel = c; FS.changed(); fillLayerEditor(); }
  function delLayer() { var p = FS.cur(), L = S.sel; p.doc.layers = p.doc.layers.filter(function (x) { return x !== L; }); S.sel = null; closeLayerEditor(); FS.changed(); }
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
    $('#fmt').value = p.doc.fmt;
    syncAdj(); syncPhotoControls(); syncFrameOpts(); syncLayers();
    if (S.sel && p.doc.layers.indexOf(S.sel) < 0) { S.sel = null; $('#layer-edit').hidden = true; }
    var bg = p.doc.photo.bg || { mode: 'none' }; $$('#bg-modes [data-bg]').forEach(function (b) { b.classList.toggle('on', b.dataset.bg === bg.mode); });
  }
  FS.syncPanels = syncPanels;

  /* ---------- start ---------- */
  FS.loadUserFrames().then(function () { if (!$('[data-pane=frames]').hidden) buildFrames(); });
  openTab(FS.prefs.tab && FS.prefs.tab !== 'games' ? FS.prefs.tab : 'photos');
  if (document.fonts) document.fonts.ready.then(function () { FS.render(); });
  FS.render();
  window.addEventListener('beforeunload', function (e) { if (S.photos.length && !FS.savedOnce) { e.preventDefault(); e.returnValue = ''; } });
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; $('#install').hidden = false; });
  $('#install').addEventListener('click', function () { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; $('#install').hidden = true; } });
})();
