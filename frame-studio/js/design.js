/* The customers' designer: a frame from the site's frames (drawn ones and the owner's PNG frames from frames/frames.json),
   their names, date, colours and font, pieces of their own invitation (read and cut by the AI in js/invite.js), new
   ornaments from a description, and changes asked for in plain words. Designs are saved in this browser; the finished
   frame goes to the business on WhatsApp, as a preview and as a see-through PNG frame the studio can use. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$;
  var esc = FS.esc || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  FS.esc = FS.esc || esc;
  FS.busy = FS.busy || function (msg) { var b = $('#busy'); if (msg) { $('#busy-msg').textContent = msg; b.hidden = false; } else b.hidden = true; };
  var OWNER = /[?&]owner\b/.test(location.search);
  var FMTS = ['magnet', 'magnetL', 'm66', 'm69', 'm710'].map(FS.fmt).filter(Boolean);
  if (!FMTS.length) FMTS = FS.FORMATS.filter(function (f) { return /magnet|^m\d/.test(f.id); });
  var PNGS = [];             // the owner's frames: { id (USER id), key, name, for }
  var D = null, P = null, view = 'photo', sel = null, invImg = null, invRead = null, saveT = null;
  var userPhoto = '';

  function blank(type) {
    var ev = FS.event(type || 'wedding');
    return { id: 'd' + FS.uid(), name: '', type: ev.id, frame: ev.frame, color: ev.color, font: ev.font, ink: '', names: ev.names, date: '', tag: '', line: '', fmt: 'magnet', deco: [], palette: [], at: Date.now() };
  }

  /* ---------- drawing ---------- */
  function frameRef() {
    if (/^png:/.test(D.frame)) { var f = PNGS.filter(function (x) { return 'png:' + x.key === D.frame; })[0]; if (f) return { kind: 'png', id: f.id, opacity: 1, tint: '', tintAmt: 0, clip: false }; }
    return null;
  }
  function sample() {
    var ev = FS.event(D.type), f = FS.fmt(D.fmt) || FS.fmt('magnet'), long = 900, w = f.w >= f.h ? long : Math.round(long * f.w / f.h), h = f.w >= f.h ? Math.round(long * f.h / f.w) : long;
    var key = ev.scene + D.fmt; sample.c = sample.c || {};
    return sample.c[key] || (sample.c[key] = FS.sampleScene(ev.scene, w, h, 3).toDataURL('image/jpeg', 0.9));
  }
  var drawing = null, again = false;
  /* scale > 1 builds the page bigger (the frame, words and ornaments are drawn at that size, not stretched) */
  function build(scale) {
    return FS.photoFrom(userPhoto || sample(), D.fmt).then(function (p) {
      var ref = frameRef();
      if (scale > 1) FS.applyFormat(p.doc, 'custom', FS.img(p.src), Math.round(p.doc.w * scale), Math.round(p.doc.h * scale));
      FS.buildMagnet(p, { type: D.type, names: D.names, date: D.date, hashtag: D.tag, frame: ref ? null : D.frame, frameRef: ref || undefined, color: D.color, font: D.font, ink: D.ink || undefined });
      var d = p.doc, m = Math.min(d.w, d.h), H = FS.hole(d);
      if (D.line) {
        var top = H.y > m * 0.1, size = Math.round(m * (top ? 0.042 : 0.04));
        d.layers.push({ id: 'line', type: 'text', text: D.line, x: d.w / 2, y: top ? H.y / 2 + size * 0.35 : H.y + m * 0.07, size: size, font: D.font, weight: 700, color: top ? (D.ink || FS.inkFor(D.color)) : '#ffffff', shadow: !top, strokeW: 0, stroke: '#000', r: 0, opacity: 1, align: 'center' });
      }
      D.deco.forEach(function (o) {
        var im = FS.img(o.src); if (!im) return;
        d.layers.push({ id: o.id, deco: true, type: 'image', src: o.src, s: o.w * d.w / im.naturalWidth, x: o.x * d.w, y: o.y * d.h, r: o.r || 0, opacity: o.opacity == null ? 1 : o.opacity, flip: !!o.flip });
      });
      return p;
    });
  }
  function render() {
    if (drawing) { again = true; return drawing; }
    drawing = Promise.all(D.deco.map(function (o) { return FS.loadImg(o.src).catch(function () {}); })).then(build).then(function (p) {
      P = p; var cv = $('#cv'), wrap = $('#wrap'), d = p.doc, box = wrap.getBoundingClientRect();
      var k = Math.min((box.width || 500) / d.w, (Math.min(window.innerHeight * 0.72, 720)) / d.h), dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(d.w * k * dpr); cv.height = Math.round(d.h * k * dpr); cv.style.width = Math.round(d.w * k) + 'px'; cv.style.height = Math.round(d.h * k) + 'px';
      FS.draw(cv.getContext('2d'), p, { scale: k * dpr, max: 1400, export: true, noPhoto: view === 'frame', transparent: view === 'frame' });
      cv.classList.toggle('see-through', view === 'frame');
      if (sel) { var o = D.deco.filter(function (x) { return x.id === sel; })[0]; if (o) outline(cv.getContext('2d'), o, d, k * dpr); }
    }).catch(function (e) { if (window.console) console.warn(e); }).then(function () { drawing = null; if (again) { again = false; render(); } });
    return drawing;
  }
  function decoBox(o, d) { var im = FS.img(o.src); if (!im) return null; var w = o.w * d.w, h = w * im.naturalHeight / im.naturalWidth; return { x: o.x * d.w - w / 2, y: o.y * d.h - h / 2, w: w, h: h }; }
  function outline(ctx, o, d, k) { var b = decoBox(o, d); if (!b) return; ctx.save(); ctx.strokeStyle = '#c9a45c'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k); ctx.restore(); }
  function changed() { render(); clearTimeout(saveT); saveT = setTimeout(function () { if (D.saved) save(true); }, 1200); }

  /* ---------- dragging ornaments on the preview ---------- */
  (function () {
    var cv = $('#cv'), drag = null;
    function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }
    cv.addEventListener('pointerdown', function (e) {
      if (!P) return; var q = pt(e), d = P.doc, hit = null;
      D.deco.slice().reverse().some(function (o) { var b = decoBox(o, d); if (b && q.x * d.w >= b.x && q.x * d.w <= b.x + b.w && q.y * d.h >= b.y && q.y * d.h <= b.y + b.h) { hit = o; return true; } return false; });
      if (!hit) { if (sel) { sel = null; decos(); render(); } return; }
      sel = hit.id; drag = { o: hit, dx: q.x - hit.x, dy: q.y - hit.y }; cv.setPointerCapture(e.pointerId); decos(); render(); e.preventDefault();
    });
    cv.addEventListener('pointermove', function (e) { if (!drag) return; var q = pt(e); drag.o.x = Math.max(0, Math.min(1, q.x - drag.dx)); drag.o.y = Math.max(0, Math.min(1, q.y - drag.dy)); render(); });
    cv.addEventListener('pointerup', function () { if (drag) { drag = null; changed(); } });
  })();

  /* ---------- the frame tab ---------- */
  function fill() {
    $('#type').innerHTML = FS.EVENTS.map(function (e) { return '<option value="' + e.id + '">' + e.icon + ' ' + e.name + '</option>'; }).join('');
    $('#font').innerHTML = FS.FONTS.map(function (f) { return '<option value="' + f[0] + '" style="font-family:\'' + f[0] + '\'">' + f[1] + '</option>'; }).join('');
    $('#fmt').innerHTML = FMTS.map(function (f) { return '<option value="' + f.id + '">' + esc(f.name) + '</option>'; }).join('');
  }
  var thumbs = {};
  function frames() {
    var box = $('#frames'), ev = FS.event(D.type);
    var hide = (FS.BIZ_SITE && FS.BIZ_SITE.hideFrames) || [];
    var gen = ev.frames.concat(FS.GEN_FRAMES.map(function (f) { return f.id; }).filter(function (id) { return ev.frames.indexOf(id) < 0; })).filter(function (id) { return hide.indexOf(id) < 0; });
    var items = PNGS.filter(function (f) { return !(f.for && f.for.length) || f.for.indexOf(D.type) > -1; }).map(function (f) { return { key: 'png:' + f.key, name: f.name, png: f } })
      .concat(gen.map(function (id) { var f = FS.GEN_FRAMES.filter(function (x) { return x.id === id; })[0]; return f ? { key: id, name: f.name } : null; }).filter(Boolean));
    box.innerHTML = items.map(function (it) { return '<button class="dz-fr' + (D.frame === it.key ? ' on' : '') + '" data-k="' + esc(it.key) + '"><span class="th"></span><small>' + esc(it.name) + (it.png ? ' ★' : '') + '</small></button>'; }).join('');
    $$('.dz-fr', box).forEach(function (b, i) {
      var it = items[i], tk = it.key + '|' + D.type + '|' + (it.png ? '' : D.color);
      b.addEventListener('click', function () { D.frame = it.key; $$('.dz-fr', box).forEach(function (x) { x.classList.toggle('on', x === b); }); changed(); });
      var put = function (c) { var th = $('.th', b); th.innerHTML = ''; th.appendChild(c.cloneNode ? cloneCanvas(c) : c); };
      if (thumbs[tk]) return put(thumbs[tk]);
      var o = { type: D.type, names: '', frame: it.png ? null : it.key, color: it.png ? undefined : D.color, frameRef: it.png ? { kind: 'png', id: it.png.id, opacity: 1 } : undefined };
      FS.magnetCanvas(o, 150).then(function (c) { thumbs[tk] = c; put(c); }).catch(function () {});
    });
  }
  function cloneCanvas(c) { var n = FS.canvas(c.width, c.height); n.getContext('2d').drawImage(c, 0, 0); return n; }
  function swatches() {
    var ev = FS.event(D.type), list = (D.palette || []).concat(ev.palette).filter(function (c, i, a) { return a.indexOf(c) === i; }).slice(0, 12);
    $('#colors').innerHTML = list.map(function (c, i) { return '<button style="--c:' + c + '" data-c="' + c + '" class="' + (D.color === c ? 'on' : '') + '" aria-label="צבע ' + c + '">' + (i < (D.palette || []).length ? '<i>📨</i>' : '') + '</button>'; }).join('');
    $$('#colors button').forEach(function (b) { b.addEventListener('click', function () { D.color = b.dataset.c; $('#color').value = D.color; swatches(); frames(); changed(); }); });
  }
  function toForm() {
    $('#type').value = D.type; $('#names').value = D.names || ''; $('#date').value = D.date || ''; $('#tag').value = D.tag || ''; $('#line').value = D.line || '';
    $('#font').value = D.font; $('#color').value = D.color; $('#fmt').value = D.fmt; $('#dname').value = D.name || '';
    $('#ink').value = !D.ink ? '' : ['#ffffff', '#1d1633', '#c9a45c'].indexOf(D.ink) > -1 ? D.ink : 'custom'; $('#ink-custom').hidden = $('#ink').value !== 'custom'; if (D.ink) $('#ink-custom').value = D.ink;
    swatches(); frames(); decos();
  }
  $('#type').addEventListener('change', function () { var ev = FS.event(this.value), was = FS.event(D.type); D.type = ev.id; if (!D.names || D.names === was.names) D.names = ev.names; if (!D.palette.length) { D.color = ev.color; D.font = ev.font; } if (!/^png:/.test(D.frame) && FS.event(D.type).frames.indexOf(D.frame) < 0 && !D.touchedFrame) D.frame = ev.frame; toForm(); changed(); });
  ['names', 'date', 'tag', 'line'].forEach(function (k) { $('#' + k).addEventListener('input', function () { D[k] = this.value; changed(); }); });
  $('#font').addEventListener('change', function () { D.font = this.value; changed(); });
  $('#fmt').addEventListener('change', function () { D.fmt = this.value; thumbs = {}; frames(); changed(); });
  $('#color').addEventListener('input', function () { D.color = this.value; swatches(); changed(); });
  $('#color').addEventListener('change', function () { frames(); });
  $('#ink').addEventListener('change', function () { var v = this.value; $('#ink-custom').hidden = v !== 'custom'; D.ink = v === 'custom' ? $('#ink-custom').value : v; changed(); });
  $('#ink-custom').addEventListener('input', function () { D.ink = this.value; changed(); });
  $('#frames').addEventListener('click', function () { D.touchedFrame = true; });

  /* ---------- tabs, view, own photo ---------- */
  $$('.dz-tabs button').forEach(function (b) { b.addEventListener('click', function () { $$('.dz-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); $$('.dz-pane').forEach(function (p) { p.hidden = p.dataset.pane !== b.dataset.tab; }); if (b.dataset.tab === 'save') mine(); }); });
  $$('[data-view]').forEach(function (b) { b.addEventListener('click', function () { view = b.dataset.view; $$('[data-view]').forEach(function (x) { x.classList.toggle('on', x === b); }); render(); }); });
  $('#photo').addEventListener('change', function () { var f = this.files[0]; if (!f) return; FS.fileToDataURL(f).then(function (u) { return shrink(u, 1600); }).then(function (u) { userPhoto = u; view = 'photo'; $$('[data-view]').forEach(function (x) { x.classList.toggle('on', x.dataset.view === 'photo'); }); render(); }); });
  function shrink(url, max, type) { return FS.loadImg(url).then(function (im) { var k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = FS.canvas(im.naturalWidth * k, im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL(type || 'image/jpeg', 0.9); }); }

  /* ---------- ornaments ---------- */
  function addDeco(canvasOrUrl, opt) {
    opt = opt || {};
    var src = typeof canvasOrUrl === 'string' ? canvasOrUrl : canvasOrUrl.toDataURL('image/png');
    return FS.loadImg(src).then(function () {
      var o = { id: 'o' + FS.uid(), src: src, x: opt.x == null ? 0.5 : opt.x, y: opt.y == null ? 0.18 : opt.y, w: opt.w || 0.3, r: opt.r || 0, flip: !!opt.flip, opacity: 1, label: opt.label || '' };
      D.deco.push(o); if (!opt.quiet) { sel = o.id; decos(); changed(); } return o;
    });
  }
  function decos() {
    var box = $('#decos');
    box.innerHTML = D.deco.length ? D.deco.map(function (o) { return '<button class="dz-deco' + (sel === o.id ? ' on' : '') + '" data-id="' + o.id + '"><img src="' + esc(o.src) + '" alt=""><small>' + esc(o.label || 'עיטור') + '</small></button>'; }).join('') : '<p class="hint">עוד אין עיטורים על המסגרת.</p>';
    $$('.dz-deco', box).forEach(function (b) { b.addEventListener('click', function () { sel = sel === b.dataset.id ? null : b.dataset.id; decos(); render(); }); });
    var o = D.deco.filter(function (x) { return x.id === sel; })[0]; $('#deco-ed').hidden = !o;
    if (o) { $('#d-size').value = Math.round(o.w * 100); $('#d-rot').value = o.r || 0; $('#d-op').value = Math.round((o.opacity == null ? 1 : o.opacity) * 100); }
  }
  function cur() { return D.deco.filter(function (x) { return x.id === sel; })[0]; }
  $('#d-size').addEventListener('input', function () { var o = cur(); if (o) { o.w = this.value / 100; changed(); } });
  $('#d-rot').addEventListener('input', function () { var o = cur(); if (o) { o.r = Number(this.value); changed(); } });
  $('#d-op').addEventListener('input', function () { var o = cur(); if (o) { o.opacity = this.value / 100; changed(); } });
  $('#d-flip').addEventListener('click', function () { var o = cur(); if (o) { o.flip = !o.flip; changed(); } });
  $('#d-del').addEventListener('click', function () { D.deco = D.deco.filter(function (x) { return x.id !== sel; }); sel = null; decos(); changed(); });
  $('#d-pair').addEventListener('click', function () { var o = cur(); if (!o) return; var c = Object.assign({}, o, { id: 'o' + FS.uid(), x: 1 - o.x, flip: !o.flip, r: -(o.r || 0) }); D.deco.push(c); decos(); changed(); });
  $('#d-corners').addEventListener('click', function () { var o = cur(); if (!o) return; corners(o); decos(); changed(); });
  function corners(o) {
    var m = 0.5 * o.w + 0.02, base = { x: m, y: m * 0.75 };
    o.x = base.x; o.y = base.y; o.flip = false; o.r = 0;
    [[1 - base.x, base.y, true, 0], [base.x, 1 - base.y, true, 180], [1 - base.x, 1 - base.y, false, 180]].forEach(function (p) { D.deco.push(Object.assign({}, o, { id: 'o' + FS.uid(), x: p[0], y: p[1], flip: p[2], r: p[3] === 180 ? 180 : 0 })); });
  }
  $('#deco-file').addEventListener('change', function () { var f = this.files[0]; if (!f) return; FS.fileToDataURL(f).then(function (u) { return shrink(u, 900, 'image/png'); }).then(function (u) { return addDeco(u, { label: 'מהמחשב' }); }); this.value = ''; });

  /* ---------- the invitation ---------- */
  function loadPdf(file) {
    var V = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
    var ready = window.pdfjsLib ? Promise.resolve() : new Promise(function (ok, no) { var s = document.createElement('script'); s.src = V + 'pdf.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    return ready.then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = V + 'pdf.worker.min.js'; return file.arrayBuffer(); })
      .then(function (buf) { return window.pdfjsLib.getDocument({ data: buf }).promise; }).then(function (doc) { return doc.getPage(1); })
      .then(function (pg) { var vp = pg.getViewport({ scale: 2 }), c = FS.canvas(vp.width, vp.height); return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () { return c.toDataURL('image/jpeg', 0.92); }); });
  }
  $('#inv-file').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return; this.value = '';
    FS.busy('טוען את ההזמנה…');
    (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name) ? loadPdf(f) : FS.fileToDataURL(f).then(function (u) { return shrink(u, 2000); }))
      .then(function (u) { return FS.loadImg(u); }).then(function (im) { FS.busy(); openInvite(im); readInvite(); })
      .catch(function () { FS.busy(); FS.toast('לא הצלחתי לפתוח את הקובץ. נסו צילום מסך של ההזמנה (JPG או PNG).', 5000); });
  });
  function openInvite(im) {
    invImg = im; invRead = null; $('#inv').hidden = false; $('#inv-img').src = im.src;
    D.palette = FS.invitePalette(im, 6);
    $('#inv-pal').innerHTML = D.palette.map(function (c) { return '<i style="--c:' + c + '" title="' + c + '"></i>'; }).join('');
    $('#inv-apply').disabled = false; swatches();
    $('#pieces').innerHTML = '<p class="hint">ה־AI מחפש קישוטים בהזמנה…</p>';
  }
  function readInvite() {
    $('#inv-status').innerHTML = '<span class="spin"></span> ה־AI קורא את ההזמנה…';
    return FS.readInvite(invImg).then(function (r) {
      invRead = r;
      $('#inv-status').innerHTML = '✔ ' + [r.names, r.date ? FS.fmtDate(r.date) : '', r.venue].filter(Boolean).map(esc).join(' · ') + (r.mood ? '<br><small>סגנון: ' + esc(r.mood) + '</small>' : '');
      if (r.palette.length) { D.palette = r.palette.concat(D.palette).filter(function (c, i, a) { return a.indexOf(c) === i; }).slice(0, 8); $('#inv-pal').innerHTML = D.palette.map(function (c) { return '<i style="--c:' + c + '" title="' + c + '"></i>'; }).join(''); swatches(); }
      pieces(r.ornaments);
    }).catch(function (e) {
      $('#inv-status').innerHTML = '⚠️ ' + esc(FS.aiError(e && e.message)) + '<br><small>הצבעים כבר נלקחו מההזמנה. אפשר לגזור קישוטים ידנית ולמלא את השמות בלשונית "טקסט".</small>';
      pieces([]);
    });
  }
  var PIECES = [];
  function pieces(list) {
    PIECES = (list || []).map(function (o) { return { label: o.label, c: FS.cutPiece(invImg, o.box) }; }).filter(function (p) { return p.c.width > 20 && p.c.height > 20; });
    drawPieces();
  }
  function drawPieces() {
    var box = $('#pieces');
    box.innerHTML = PIECES.length ? '' : '<p class="hint">לא נמצאו קישוטים אוטומטית. מסמנים אזור על ההזמנה ולוחצים "גזירה".</p>';
    PIECES.forEach(function (p) {
      var b = document.createElement('button'); b.className = 'dz-piece'; b.title = 'הוספה למסגרת';
      var t = FS.canvas(p.c.width, p.c.height); t.getContext('2d').drawImage(p.c, 0, 0); b.appendChild(t);
      var s = document.createElement('small'); s.textContent = p.label || 'חלק'; b.appendChild(s);
      b.addEventListener('click', function () { addDeco(p.c, { label: p.label, w: 0.28, y: 0.16 }).then(function () { FS.toast('נוסף. אפשר לגרור אותו על המגנט, ובלשונית "עיטורים" לשנות גודל או לשכפל לפינות.', 4500); }); });
      box.appendChild(b);
    });
  }
  /* a hand-drawn box on the invitation */
  (function () {
    var boxEl = $('#inv-box'), mark = $('#inv-sel'), start = null, rect = null;
    function pt(e) { var r = $('#inv-img').getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; }
    boxEl.addEventListener('pointerdown', function (e) { if (!invImg) return; start = pt(e); rect = null; boxEl.setPointerCapture(e.pointerId); e.preventDefault(); });
    boxEl.addEventListener('pointermove', function (e) {
      if (!start) return; var q = pt(e); rect = { x: Math.min(start.x, q.x), y: Math.min(start.y, q.y), w: Math.abs(q.x - start.x), h: Math.abs(q.y - start.y) };
      mark.hidden = false; mark.style.left = rect.x * 100 + '%'; mark.style.top = rect.y * 100 + '%'; mark.style.width = rect.w * 100 + '%'; mark.style.height = rect.h * 100 + '%';
    });
    boxEl.addEventListener('pointerup', function () { start = null; $('#inv-cut').disabled = !(rect && rect.w > 0.02 && rect.h > 0.02); });
    $('#inv-cut').addEventListener('click', function () {
      if (!rect) return; var c = FS.cutPiece(invImg, [rect.y * 1000, rect.x * 1000, (rect.y + rect.h) * 1000, (rect.x + rect.w) * 1000]);
      PIECES.unshift({ label: 'גזירה שלי', c: c }); drawPieces(); mark.hidden = true; rect = null; this.disabled = true;
      addDeco(c, { label: 'גזירה שלי', w: 0.3 });
    });
  })();
  /* everything at once: event, words, colours, font, a fitting frame and the best ornaments in the corners */
  $('#inv-apply').addEventListener('click', function () {
    var r = invRead || {};
    if (r.eventType) D.type = r.eventType;
    if (r.names) D.names = r.names; else if (r.title) D.names = r.title;
    if (r.date) D.date = r.date;
    if (r.line) D.line = r.line;
    if (r.font) D.font = FS.fontFor(r.font);
    D.color = FS.accentOf(D.palette);
    if (r.frame && !/^png:/.test(D.frame)) D.frame = r.frame;
    var p = PIECES.slice().sort(function (a, b) { return (b.c.width * b.c.height) - (a.c.width * a.c.height); });
    D.deco = D.deco.filter(function (o) { return !o.auto; });
    var chain = Promise.resolve();
    var wide = p.filter(function (x) { return x.c.width > x.c.height * 2.5; })[0];
    p = p.filter(function (x) { return x !== wide; });
    if (p[0]) chain = chain.then(function () { return addDeco(p[0].c, { label: p[0].label, w: 0.19, quiet: true }).then(function (o) { o.auto = true; corners(o); D.deco.forEach(function (x) { if (x.src === o.src) x.auto = true; }); }); });
    if (wide) chain = chain.then(function () { return addDeco(wide.c, { label: wide.label, w: 0.42, x: 0.5, y: 0.035, quiet: true }).then(function (o) { o.auto = true; }); });
    chain.then(function () { thumbs = {}; toForm(); changed(); FS.toast('✨ המסגרת עוצבה לפי ההזמנה. אפשר לשנות כל פרט.', 4500); });
  });

  /* ---------- design in words ---------- */
  var IDEAS = ['יותר יוקרתי, בזהב', 'פרחים בפינות', 'צבעי פסטל עדינים', 'גופן כתב יד', 'מינימליסטי ונקי', 'שמח וצבעוני לילדים'];
  $('#ai-chips').innerHTML = IDEAS.map(function (t) { return '<button>' + esc(t) + '</button>'; }).join('');
  $$('#ai-chips button').forEach(function (b) { b.addEventListener('click', function () { var a = $('#ai-ask'); a.value = (a.value ? a.value + ', ' : '') + b.textContent; }); });
  $('#ai-go').addEventListener('click', function () {
    var ask = $('#ai-ask').value.trim(); if (!ask) return FS.toast('כותבים מה לשנות');
    var frames = FS.GEN_FRAMES.map(function (f) { return f.id + ' (' + f.name + ')'; }).join(', '), fonts = FS.FONTS.map(function (f) { return f[0]; }).join(', ');
    var now = { type: D.type, frame: D.frame, color: D.color, font: D.font, names: D.names, line: D.line, ornaments: D.deco.length };
    var prompt = 'You design photo-magnet frames for events. Current design: ' + JSON.stringify(now) + '.\nThe customer asks (Hebrew): "' + ask.replace(/"/g, "'") + '"\n' +
      'Answer ONLY with JSON of the fields to change: {"frame":"id from: ' + frames + '","color":"#hex","font":"one of: ' + fonts + '","ink":"#hex text colour or empty","names":"...","line":"short Hebrew line or empty","ornament":"if they want a new decoration, a short English description for an image generator (on a plain white background), else empty","layout":"corners|top|pair|none","say":"one short friendly Hebrew sentence about what you changed"}. Keep names unless asked.';
    var out = $('#ai-out'); out.innerHTML = '<p class="hint"><span class="spin"></span> ה־AI מעצב…</p>';
    FS.askServer({ action: 'ai', tag: 'design', prompt: prompt }).then(function (r) {
      if (!r || !r.ok || !r.text) throw new Error((r && r.error) || 'ai-failed');
      var t = r.text, j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      if (FS.GEN_FRAMES.some(function (f) { return f.id === j.frame; })) D.frame = j.frame;
      if (/^#[0-9a-f]{6}$/i.test(j.color || '')) D.color = j.color;
      if (FS.FONTS.some(function (f) { return f[0] === j.font; })) D.font = j.font;
      if (/^#[0-9a-f]{6}$/i.test(j.ink || '')) D.ink = j.ink;
      if (typeof j.names === 'string' && j.names.trim()) D.names = j.names.slice(0, 40);
      if (typeof j.line === 'string') D.line = j.line.slice(0, 44);
      out.innerHTML = '<p>✨ ' + esc(j.say || 'עודכן') + '</p>'; thumbs = {}; toForm(); changed();
      if (j.ornament && String(j.ornament).trim()) return ornament(String(j.ornament).slice(0, 160), j.layout || 'corners');
    }).catch(function (e) { out.innerHTML = '<p class="hint">⚠️ ' + esc(FS.aiError(e && e.message)) + '</p>'; });
  });
  function ornament(desc, layout) {
    FS.busy('🎨 יוצר עיטור… (עד חצי דקה)');
    return FS.askServer({ action: 'image', prompt: desc + ', isolated decorative ornament on a plain pure white background, no text, clean edges, high detail', w: 768, h: 768 }).then(function (r) {
      if (!r || !r.ok || !r.image) throw new Error((r && r.error) || 'ai-failed');
      return FS.loadImg('data:' + (r.mime || 'image/jpeg') + ';base64,' + r.image);
    }).then(function (im) {
      FS.busy(); var c = FS.cutPiece(im, [0, 0, 1000, 1000], { tol: 40 });
      return addDeco(c, { label: desc.slice(0, 24), w: layout === 'top' ? 0.42 : 0.26, y: layout === 'top' ? 0.1 : 0.16, quiet: true }).then(function (o) {
        if (layout === 'corners') corners(o); else if (layout === 'pair') { o.x = 0.18; D.deco.push(Object.assign({}, o, { id: 'o' + FS.uid(), x: 0.82, flip: true })); }
        sel = o.id; decos(); changed(); FS.toast('🎨 העיטור נוסף. גוררים אותו או משנים בלשונית "עיטורים".', 4500);
      });
    }).catch(function (e) { FS.busy(); FS.toast('העיטור לא נוצר: ' + FS.aiError(e && e.message), 6000); });
  }
  $('#orn-go').addEventListener('click', function () { var t = $('#orn-ask').value.trim(); if (!t) return FS.toast('מתארים את העיטור'); var he = /[֐-׿]/.test(t);
    (he ? FS.askServer({ action: 'ai', tag: 'design', prompt: 'Translate to a short English image prompt, answer with the prompt only: ' + t }).then(function (r) { return r && r.ok && r.text ? r.text.replace(/^["'\s]+|["'\s]+$/g, '') : t; }) : Promise.resolve(t))
      .then(function (en) { return ornament(en, 'top'); }); });

  /* ---------- saving, sending ---------- */
  /* max: the long side in pixels; a magnet's page is 300dpi, so 2x gives 600dpi */
  function snapshot(max, frameOnly) {
    var f = FS.fmt(D.fmt) || FS.fmt('magnet'), long = Math.max(f.w, f.h), scale = Math.max(1, (max || 2400) / long);
    return Promise.all(D.deco.map(function (o) { return FS.loadImg(o.src).catch(function () {}); })).then(function () { return build(scale); }).then(function (p) { var d = p.doc, k = Math.min(1, (max || 2400) / Math.max(d.w, d.h)), c = FS.canvas(d.w * k, d.h * k); FS.draw(c.getContext('2d'), p, { scale: k, max: 2400, export: true, noPhoto: !!frameOnly, transparent: !!frameOnly }); return c; });
  }
  var ACC = FS.account;
  function cloud() { return !!(ACC && ACC.signedIn()); }
  /* saved in this browser, and in the customer's account on the server when signed in (it stays there, on any device) */
  function save(quiet) {
    D.name = $('#dname').value.trim() || D.names || 'העיצוב שלי'; D.at = Date.now(); D.saved = true;
    return snapshot(320).then(function (c) { D.thumb = c.toDataURL('image/jpeg', 0.75); var copy = JSON.parse(JSON.stringify(D)); return FS.store.put('mydesigns', copy).catch(function () {}).then(function () { return copy; }); })
      .then(function (copy) {
        if (!cloud()) { if (!quiet) { FS.toast('💾 נשמר בדפדפן הזה. כדי שיישמר בחשבון ולא יאבד: "👤 החשבון שלי".', 5000); mine(); } return; }
        return ACC.call('design-save', { design: copy }).then(function (r) { if (!quiet || !r.ok) FS.toast(r.ok ? '☁️ נשמר בחשבון שלך' : 'נשמר בדפדפן. בחשבון: ' + ACC.msg(r), 5000); if (!quiet) mine(); });
      }).catch(function () { if (!quiet) FS.toast('השמירה לא הצליחה'); });
  }
  function mine() {
    var box = $('#mine');
    Promise.all([FS.store.all('mydesigns').catch(function () { return []; }), cloud() ? ACC.call('designs') : Promise.resolve(null)]).then(function (r) {
      var loc = r[0] || [], srv = r[1] && r[1].ok ? r[1].designs : null, ids = {};
      var l = (srv || []).map(function (x) { ids[x.id] = 1; return Object.assign({ cloud: true }, x); }).concat(loc.filter(function (x) { return !ids[x.id]; }).map(function (x) { return { id: x.id, name: x.name, at: x.at, thumb: x.thumb, type: x.type, local: true }; }));
      l.sort(function (a, b) { return b.at - a.at; });
      box.innerHTML = (cloud() ? '' : '<p class="note-acc">🔒 העיצובים כרגע רק בדפדפן הזה. <button class="link" data-acc>פתיחת חשבון / כניסה</button> שומרים אותם בחשבון, בכל מכשיר.</p>') +
        (l.length ? l.map(function (x) { return '<figure data-id="' + esc(x.id) + '"><img src="' + esc(x.thumb || '') + '" alt=""><figcaption><b>' + esc(x.name) + '</b><small>' + (x.cloud ? '☁️ ' : '💻 ') + new Date(x.at).toLocaleDateString('he-IL') + '</small></figcaption><div><button class="btn small" data-open>פתיחה</button><button class="btn small danger" data-del>מחיקה</button></div></figure>'; }).join('') : '<p class="hint">עוד לא נשמרו עיצובים.</p>');
      var a = box.querySelector('[data-acc]'); if (a) a.addEventListener('click', openAcc);
      $$('figure', box).forEach(function (f) { var x = l.filter(function (y) { return y.id === f.dataset.id; })[0];
        $('[data-open]', f).addEventListener('click', function () {
          (x.cloud ? ACC.call('design-get', { id: x.id }).then(function (r) { return r.ok ? r.design : null; }) : FS.store.get('mydesigns', x.id)).then(function (full) {
            if (!full) return FS.toast('לא הצלחתי לפתוח'); D = Object.assign(blank(full.type), full); sel = null; thumbs = {}; toForm(); render(); FS.toast('נפתח: ' + full.name);
          });
        });
        $('[data-del]', f).addEventListener('click', function () { if (!confirm('למחוק את "' + x.name + '"?')) return; Promise.all([FS.store.del('mydesigns', x.id).catch(function () {}), x.cloud ? ACC.call('design-del', { id: x.id }) : null]).then(mine); }); });
    });
  }
  /* ---------- the customer's account ---------- */
  function accLabel() { var s = ACC && ACC.session(); $('#acc-btn').textContent = s && s.token && !s.mustChange ? '👤 ' + String(s.email || '').split('@')[0] : '👤 החשבון שלי'; }
  function openAcc() {
    var wrap = document.createElement('div'); wrap.className = 'acc-modal'; wrap.innerHTML = '<div role="dialog" aria-label="החשבון שלי"><button class="x" aria-label="סגירה">✕</button><div id="acc-in"></div></div>'; document.body.appendChild(wrap);
    function close() { wrap.remove(); accLabel(); }
    wrap.querySelector('.x').addEventListener('click', close); wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    var inBox = wrap.querySelector('#acc-in'), s = ACC.session();
    if (cloud()) {
      inBox.innerHTML = '<div class="acc"><h2>החשבון שלי</h2><p dir="ltr">' + esc(s.email) + '</p><p class="hint">העיצובים שנשמרים כאן שמורים בחשבון שלך, בכל מכשיר, ולא נמחקים.</p><button class="btn gold" id="acc-up">☁️ העלאת העיצובים מהדפדפן הזה לחשבון</button><button class="btn line" id="acc-out">יציאה</button><h3>📅 ההזמנות שלי</h3><div id="acc-rq" class="hint">…</div><a class="btn line" href="./#contact">📅 בקשת הזמנה חדשה</a></div>';
      ACC.call('my-requests').then(function (r) {
        var box = inBox.querySelector('#acc-rq'); if (!box) return;
        var ST = { pending: '⏳ ממתינה לאישור', approved: '✔ אושרה', declined: '✖ לא אושרה' };
        box.innerHTML = r && r.ok && r.requests.length ? '<ul class="acc-rq">' + r.requests.map(function (q) { return '<li><b>' + esc(q.ref) + ' · ' + esc(new Date(q.date + 'T12:00:00').toLocaleDateString('he-IL')) + ' · ' + esc(q.typeName || '') + '</b><span>' + (ST[q.status] || '') + '</span>' + (q.answer ? '<small>' + esc(q.answer) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : 'עוד אין בקשות הזמנה בחשבון.';
      });
      inBox.querySelector('#acc-out').addEventListener('click', function () { ACC.logout(); close(); mine(); });
      inBox.querySelector('#acc-up').addEventListener('click', function () { uploadLocal().then(close); });
      return;
    }
    ACC.form(inBox, { signup: true, done: function () { close(); FS.toast('👋 נכנסת. העיצובים יישמרו בחשבון שלך.', 5000); uploadLocal().then(mine); } });
  }
  function uploadLocal() {
    return FS.store.all('mydesigns').then(function (l) {
      l = l || []; if (!l.length) return;
      return l.reduce(function (p, d) { return p.then(function () { return ACC.call('design-save', { design: d }); }); }, Promise.resolve()).then(function () { FS.toast('☁️ ' + l.length + ' עיצובים נשמרו בחשבון'); });
    }).catch(function () {});
  }
  $('#acc-btn').addEventListener('click', openAcc);

  function dl(c, name) { c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000); }, 'image/png'); }
  $('#s-save').addEventListener('click', function () { save(); });
  $('#s-new').addEventListener('click', function () { if (!confirm('להתחיל עיצוב חדש? העיצוב הנוכחי נשאר אם שמרתם אותו.')) return; D = blank(D.type); sel = null; toForm(); render(); });
  function fileName(kind) { var n = String(D.name || D.names || 'מגנט').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 40); return (kind === 'frame' ? 'מסגרת-' : 'הדמיה-') + n + '.png'; }
  /* the PNG at print quality: the page's long side at 600dpi */
  function savePng(frameOnly) {
    var f = FS.fmt(D.fmt) || FS.fmt('magnet'), px = Math.round(Math.max(f.w, f.h) * 2);
    FS.busy('מכין PNG באיכות הדפסה…');
    return snapshot(px, frameOnly).then(function (c) { FS.busy(); dl(c, fileName(frameOnly ? 'frame' : 'design')); FS.toast('⬇️ ' + (frameOnly ? 'המסגרת נשמרה כ־PNG שקוף' : 'ההדמיה נשמרה כ־PNG') + ' · ' + c.width + '×' + c.height + ' (600dpi)', 5000); save(true); })
      .catch(function () { FS.busy(); FS.toast('השמירה כ־PNG לא הצליחה'); });
  }
  $('#s-png').addEventListener('click', function () { savePng(false); });
  $('#s-frame').addEventListener('click', function () { savePng(true); });
  $('#png-frame').addEventListener('click', function () { savePng(true); });
  $('#png-design').addEventListener('click', function () { savePng(false); });
  $('#s-send').addEventListener('click', function () {
    var B = FS.BIZ_SITE || FS.BIZ || {}, n = String(B.whatsapp || B.phone || '').replace(/\D/g, ''); if (n.charAt(0) === '0') n = '972' + n.slice(1);
    var ev = FS.event(D.type), fr = /^png:/.test(D.frame) ? (PNGS.filter(function (x) { return 'png:' + x.key === D.frame; })[0] || {}).name : (FS.GEN_FRAMES.filter(function (f) { return f.id === D.frame; })[0] || {}).name;
    var text = 'שלום! עיצבתי מסגרת באתר 🧲\nאירוע: ' + ev.name + '\nשמות: ' + (D.names || '') + (D.date ? '\nתאריך: ' + FS.fmtDate(D.date) : '') + '\nמסגרת: ' + (fr || '') + ' · צבע ' + D.color + (D.deco.length ? '\nעיטורים: ' + D.deco.length : '') + '\n(מצרף/ת את המסגרת והדמיה)';
    save(true);
    Promise.all([snapshot(1800), snapshot(2400, true)]).then(function (cs) {
      return Promise.all(cs.map(function (c, i) { return new Promise(function (ok) { c.toBlob(function (b) { ok(new File([b], i ? 'frame.png' : 'design.png', { type: 'image/png' })); }, 'image/png'); }); }));
    }).then(function (files) {
      if (navigator.canShare && navigator.canShare({ files: files }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return navigator.share({ files: files, text: text }).catch(function () {});
      files.forEach(function (f) { var a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); });
      window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(text + '\n(הקבצים ירדו למחשב, אצרף אותם כאן)'), '_blank', 'noopener');
    });
  });
  $('#s-studio').hidden = !OWNER;
  $('#s-studio').addEventListener('click', function () { snapshot(2400, true).then(function (c) { return FS.addUserFrame(c.toDataURL('image/png'), D.name || D.names || 'מסגרת מעוצבת'); }).then(function (f) { FS.toast(f.solid ? 'נשמר, אבל לא נמצא חלון שקוף במסגרת' : '🖼️ נוסף ל"המסגרות שלי" בסטודיו (בסטודיו פתוח מרעננים את הדף)', 5000); }); });

  /* ---------- start ---------- */
  fill();
  var SITE_FRAMES = [];
  var biz = FS.siteData().then(function (b) {
    SITE_FRAMES = b.__frames || []; delete b.__frames; delete b.__live; delete b.__taken;
    FS.BIZ_SITE = b; FS.BIZ = Object.assign({}, FS.BIZ, b || {}, { credit: Object.assign({}, FS.BIZ.credit, (b && b.credit) || {}) });
    $$('[data-biz]').forEach(function (e) { if (b[e.dataset.biz]) e.textContent = b[e.dataset.biz]; });
  });
  /* the owner's PNG frames: the ones uploaded in the admin (on the server) and any in frames/frames.json */
  var pngs = Promise.all([biz, fetch('frames/frames.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })]).then(function (r) {
    var list = (Array.isArray(r[1]) ? r[1] : []).filter(function (f) { return f && /^frames\/[\w.-]+\.png$/i.test(f.src || '') && !f.hidden; }).map(function (f) { return Promise.resolve({ f: f, src: f.src }); })
      .concat(SITE_FRAMES.map(function (f) { return FS.frameFileUrl(f.id).then(function (u) { return { f: f, src: u + '&v=' + (f.v || 1) }; }); }));
    return Promise.all(list).then(function (items) { return Promise.all(items.map(function (it) {
      return FS.addUserFrame(it.src, it.f.name, false).then(function (u) { PNGS.push({ id: u.id, key: it.f.id || u.id, name: it.f.name || 'מסגרת', for: it.f.for || [] }); }).catch(function () {});
    })); });
  });
  var q = new URLSearchParams(location.search);
  D = blank(q.get('type') || 'wedding');
  if (q.get('frame')) D.frame = q.get('frame');
  if (q.get('names')) D.names = q.get('names').slice(0, 40);
  Promise.all([biz, pngs]).then(function () { toForm(); render(); openFromLink(); });
  accLabel();
  if (ACC && ACC.session()) ACC.me().then(accLabel);
  /* design.html?owner&open=<email>:<id>: the owner opens a customer's design from the admin */
  function openFromLink() {
    var o = q.get('open'); if (!o || !ACC || !ACC.isAdmin()) return;
    var k = o.lastIndexOf(':'); ACC.call('design-of', { email: o.slice(0, k), id: o.slice(k + 1) }).then(function (r) { if (!r.ok) return FS.toast(ACC.msg(r)); D = Object.assign(blank(r.design.type), r.design, { id: 'd' + FS.uid(), saved: false }); thumbs = {}; toForm(); render(); FS.toast('נפתח העיצוב של ' + o.slice(0, k) + ' (כעותק)', 5000); });
  }
  window.addEventListener('resize', function () { render(); });
  FS.designer = { state: function () { return D; }, render: render, addDeco: addDeco, openInvite: openInvite, pieces: function () { return PIECES; } };
})();
