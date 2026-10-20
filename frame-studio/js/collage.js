/* Collages: several photos on one page, arranged automatically.
   The layout is a guillotine tree (each cut splits a box side by side or one above the other). Thousands of trees are
   tried; split ratios follow the photos' own proportions, and the winner is the one that crops the photos least and
   keeps their sizes even (or gives the first photo the stage, in "hero" mode). Photos are cropped around their faces.
   The finished collage joins the project as a page of its own, so it prints, saves and takes frames like any photo. */
(function () {
  'use strict';
  var FS = window.FS, $ = FS.$, $$ = FS.$$, S = FS.state;

  /* ---------- layout ---------- */
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function shuffle(a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  /* the aspect a subtree wants: side by side adds aspects, one above the other adds inverse aspects */
  function aspectOf(t) { if (t.leaf != null) return t.ar; var a = aspectOf(t.a), b = aspectOf(t.b); return t.dir === 'h' ? a + b : 1 / (1 / a + 1 / b); }
  function tree(items, r, W, H) {
    if (items.length === 1) return { leaf: items[0].i, ar: items[0].ar };
    var k = 1 + Math.floor(r() * (items.length - 1)), dir = r() < (W > H ? 0.72 : 0.28) ? 'h' : 'v';
    return { dir: dir, a: tree(items.slice(0, k), r, W, H), b: tree(items.slice(k), r, W, H) };
  }
  function place(t, x, y, w, h, gap, out) {
    if (t.leaf != null) { out.push({ i: t.leaf, ar: t.ar, x: x, y: y, w: w, h: h }); return out; }
    var a = aspectOf(t.a), b = aspectOf(t.b), f;
    if (t.dir === 'h') { f = Math.max(0.2, Math.min(0.8, a / (a + b))); var wa = (w - gap) * f; place(t.a, x, y, wa, h, gap, out); place(t.b, x + wa + gap, y, w - gap - wa, h, gap, out); }
    else { f = Math.max(0.2, Math.min(0.8, (1 / a) / (1 / a + 1 / b))); var ha = (h - gap) * f; place(t.a, x, y, w, ha, gap, out); place(t.b, x, y + ha + gap, w, h - gap - ha, gap, out); }
    return out;
  }
  function cost(cells, W, H, hero) {
    var area = W * H, c = 0, mean = area / cells.length, sizes = [];
    cells.forEach(function (q) { var ca = q.w / q.h, crop = 1 - Math.min(ca / q.ar, q.ar / ca); c += crop * crop * 3 + crop; sizes.push(q.w * q.h); if (q.w * q.h < mean * 0.35) c += 1.5; if (Math.min(q.w, q.h) < Math.min(W, H) * 0.12) c += 1; });
    if (hero) { var first = cells.filter(function (q) { return q.i === hero.i; })[0]; c += Math.abs(first.w * first.h / area - 0.45) * 6; }
    else { var m = sizes.reduce(function (a, b) { return a + b; }, 0) / sizes.length, v = 0; sizes.forEach(function (s) { v += (s - m) * (s - m); }); c += Math.sqrt(v / sizes.length) / m * 0.9; }
    return c;
  }
  /* best few distinct layouts for these photo aspects in a W×H box */
  FS.collageLayouts = function (ars, W, H, gap, mode, seed) {
    var items = ars.map(function (ar, i) { return { i: i, ar: ar }; }), r = rnd(seed || 7), found = [];
    if (mode === 'grid') {
      var n = items.length, best = null;
      for (var cols = 1; cols <= n; cols++) { var rows = Math.ceil(n / cols), cw = (W - gap * (cols - 1)) / cols, ch = (H - gap * (rows - 1)) / rows, s = Math.abs(Math.log((cw / ch) / (ars.reduce(function (a, b) { return a + b; }, 0) / n))) + (rows * cols - n) * 0.25; if (!best || s < best.s) best = { s: s, cols: cols, rows: rows, cw: cw, ch: ch }; }
      var cells = items.map(function (it, k) { var rr = Math.floor(k / best.cols), cc = k % best.cols, inRow = Math.min(best.cols, n - rr * best.cols), off = (best.cols - inRow) * (best.cw + gap) / 2; return { i: it.i, ar: it.ar, x: off + cc * (best.cw + gap), y: rr * (best.ch + gap), w: best.cw, h: best.ch }; });
      return [cells];
    }
    var tries = Math.min(4000, 400 * items.length);
    for (var t = 0; t < tries; t++) {
      var order = shuffle(items, r), tr;
      if (mode === 'hero') { var h0 = items[0], rest = order.filter(function (x) { return x.i !== 0; }); if (!rest.length) tr = { leaf: 0, ar: h0.ar }; else { var sub = tree(rest, r, W, H); tr = r() < 0.5 ? { dir: W >= H ? 'h' : 'v', a: { leaf: 0, ar: h0.ar }, b: sub } : { dir: W >= H ? 'h' : 'v', a: sub, b: { leaf: 0, ar: h0.ar } }; } }
      else tr = tree(order, r, W, H);
      var cs = place(tr, 0, 0, W, H, gap, []), sc = cost(cs, W, H, mode === 'hero' ? items[0] : null);
      found.push({ sc: sc, cells: cs, key: cs.map(function (q) { return q.i + ':' + Math.round(q.x / W * 8) + Math.round(q.y / H * 8); }).sort().join('|') });
    }
    found.sort(function (a, b) { return a.sc - b.sc; });
    var seen = {}, out = [];
    for (var j = 0; j < found.length && out.length < 12; j++) { if (seen[found[j].key]) continue; seen[found[j].key] = 1; out.push(found[j].cells); }
    return out;
  };

  /* ---------- drawing ---------- */
  function rr(x, X, Y, w, h, r) { if (!r) { x.rect(X, Y, w, h); return; } FS.roundRect(x, X, Y, w, h, r); }
  /* cover-crop around the faces (or the centre) */
  function drawCell(x, p, q, ox, oy, rad) {
    var im = FS.img(p.src); if (!im) return;
    var iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max(q.w / iw, q.h / ih), sw = q.w / s, sh = q.h / s, cx = iw / 2, cy = ih / 2;
    if (p.faces && p.faces.length) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; p.faces.forEach(function (f) { x0 = Math.min(x0, f.x); y0 = Math.min(y0, f.y); x1 = Math.max(x1, f.x + f.w); y1 = Math.max(y1, f.y + f.h); }); cx = (x0 + x1) / 2; cy = (y0 + y1) / 2 + (y1 - y0) * 0.15; }
    var sx = Math.max(0, Math.min(iw - sw, cx - sw / 2)), sy = Math.max(0, Math.min(ih - sh, cy - sh / 2));
    x.save(); x.beginPath(); rr(x, ox + q.x, oy + q.y, q.w, q.h, rad); x.clip(); x.drawImage(im, sx, sy, sw, sh, ox + q.x, oy + q.y, q.w, q.h); x.restore();
  }
  /* the page: margin, background, cells, an optional title band */
  FS.drawCollage = function (photos, cells, o, scale) {
    var W = Math.round(o.W * scale), H = Math.round(o.H * scale), c = FS.canvas(W, H), x = c.getContext('2d');
    x.fillStyle = o.bg; x.fillRect(0, 0, W, H); x.imageSmoothingQuality = 'high';
    var m = o.margin * scale, band = o.title ? H * 0.11 : 0, k = (W - m * 2) / o.boxW;
    cells.forEach(function (q) { var s = { x: q.x * k, y: q.y * k, w: q.w * k, h: q.h * k }; drawCell(x, photos[q.i], s, m, m + (o.titleTop ? band : 0), o.radius * scale); });
    if (o.title) {
      var fy = o.titleTop ? m + band * 0.52 : H - m - band * 0.42, fz = Math.round(band * 0.46);
      x.fillStyle = o.ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      x.font = '700 ' + fz + 'px "Frank Ruhl Libre", "David Libre", serif'; x.fillText(o.title, W / 2, fy);
    }
    return c;
  };

  /* ---------- the panel ---------- */
  var pane = document.createElement('section'); pane.dataset.pane = 'collage'; pane.hidden = true;
  pane.innerHTML = '<h2>קולאז׳</h2><p class="hint">בוחרים תמונות, והן מסתדרות בדף אחד כך שכל תמונה נראית כמעט שלמה. הפנים נשארות בפנים.</p>' +
    '<div class="field"><label>התמונות <output id="cl-n"></output></label><div class="cl-pick" id="cl-pick"></div>' +
    '<div class="row2"><button class="btn small" id="cl-all">כולן</button><button class="btn small" id="cl-marked">המסומנות</button></div></div>' +
    '<div class="row2"><div class="field"><label>גודל הדף</label><select id="cl-size"></select></div><div class="field"><label>כיוון</label><select id="cl-orient"><option value="p">לאורך</option><option value="l">לרוחב</option></select></div></div>' +
    '<div class="field"><label>סידור</label><div class="chips" id="cl-mode"><button data-m="auto" class="on">אוטומטי מושלם</button><button data-m="hero">תמונה ראשית גדולה</button><button data-m="grid">רשת אחידה</button></div></div>' +
    '<div class="row2"><div class="field"><label>רווח <output id="o-cl-gap">3 מ״מ</output></label><input type="range" id="cl-gap" min="0" max="12" step="0.5" value="3"></div><div class="field"><label>פינות <output id="o-cl-rad">0</output></label><input type="range" id="cl-rad" min="0" max="12" step="1" value="0"></div></div>' +
    '<div class="row2"><div class="field"><label>רקע</label><input type="color" id="cl-bg" value="#ffffff"></div><div class="field"><label>צבע הכותרת</label><input type="color" id="cl-ink" value="#2a2238"></div></div>' +
    '<div class="field"><label>כותרת (לא חובה)</label><input id="cl-title" maxlength="50" placeholder="למשל: נועה & דניאל · 12.06.2027"></div>' +
    '<div class="cl-preview"><canvas id="cl-canvas"></canvas></div>' +
    '<div class="row2"><button class="btn" id="cl-shuffle">🔀 סידור אחר</button><button class="btn primary" id="cl-make">✔ יצירת הקולאז׳</button></div>';
  var panel = $('#panel'); panel.insertBefore(pane, $('[data-pane=output]', panel));
  /* the rail button, before "save and print" */
  var tab = document.createElement('button'); tab.setAttribute('role', 'tab'); tab.dataset.tab = 'collage';
  tab.innerHTML = '<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="10" height="11" rx="1"/><rect x="15" y="3" width="6" height="7" rx="1"/><rect x="15" y="12" width="6" height="9" rx="1"/><rect x="3" y="16" width="10" height="5" rx="1"/></svg>קולאז׳';
  var rail = $('.tools'); rail.insertBefore(tab, $('[data-tab=output]', rail));
  tab.addEventListener('click', function () { FS.openTab('collage'); });

  var pick = {}, mode = 'auto', layouts = [], li = 0, seed = 7;
  var PAGES = [['A4', 'A4', 210, 297], ['20x30', '20×30', 200, 300], ['15x20', '15×20', 150, 200], ['10x15', '10×15', 100, 150], ['20x20', 'ריבוע 20×20', 200, 200], ['30x40', '30×40', 300, 400]];
  function sizes() {
    var mine = (FS.mySizes ? FS.mySizes() : []).filter(function (z) { return Math.max(z.w, z.h) >= 100; }).map(function (z) { return ['my:' + z.id, FS.sizeLabel(z), Math.min(z.w, z.h), Math.max(z.w, z.h)]; });
    var all = PAGES.concat(mine.filter(function (m) { return !PAGES.some(function (p) { return p[2] === m[2] && p[3] === m[3]; }); }));
    $('#cl-size').innerHTML = all.map(function (p) { return '<option value="' + p[0] + '" data-w="' + p[2] + '" data-h="' + p[3] + '">' + FS.esc(p[1]) + '</option>'; }).join('');
    $('#cl-size').value = FS.prefs.clSize || 'A4';
  }
  function chosen() { return S.photos.filter(function (p) { return pick[p.id]; }); }
  function opts() {
    var o = $('#cl-size').selectedOptions[0] || {}, a = Number(o.dataset ? o.dataset.w : 210) || 210, b = Number(o.dataset ? o.dataset.h : 297) || 297, land = $('#cl-orient').value === 'l';
    var W = land ? Math.max(a, b) : Math.min(a, b), H = land ? Math.min(a, b) : Math.max(a, b), margin = Math.max(4, Math.min(W, H) * 0.035), title = $('#cl-title').value.trim();
    var band = title ? H * 0.11 : 0, boxW = W - margin * 2, boxH = H - margin * 2 - band;
    return { W: W, H: H, margin: margin, boxW: boxW, boxH: boxH, gap: Number($('#cl-gap').value), radius: Number($('#cl-rad').value), bg: $('#cl-bg').value, ink: $('#cl-ink').value, title: title, titleTop: false };
  }
  function ars() { return chosen().map(function (p) { var im = FS.img(p.src); return im ? im.naturalWidth / im.naturalHeight : 1.5; }); }
  function relayout() {
    var l = chosen(), o = opts(); $('#cl-n').textContent = l.length + ' נבחרו';
    if (l.length < 2) { layouts = []; draw(); return; }
    layouts = FS.collageLayouts(ars(), o.boxW, o.boxH, o.gap, mode, seed); li = 0; draw();
  }
  function draw() {
    var cv = $('#cl-canvas'), o = opts(), l = chosen(), box = $('.cl-preview'), k = Math.min(box.clientWidth || 300, 420) / o.W;
    if (!layouts.length) { cv.width = Math.round(o.W * k); cv.height = Math.round(o.H * k); var x = cv.getContext('2d'); x.fillStyle = '#2a2a30'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#aaa'; x.font = '15px Assistant, sans-serif'; x.textAlign = 'center'; x.fillText('בוחרים לפחות 2 תמונות', cv.width / 2, cv.height / 2); return; }
    var c = FS.drawCollage(l, layouts[li], o, k * 2); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0);
  }
  function thumbs() {
    $('#cl-pick').innerHTML = '';
    S.photos.forEach(function (p) {
      var b = document.createElement('button'); b.className = 'cl-th' + (pick[p.id] ? ' on' : ''); b.title = p.name;
      var im = FS.img(p.src); if (im) { var c = FS.canvas(72, 72), x = c.getContext('2d'), s = Math.max(72 / im.naturalWidth, 72 / im.naturalHeight); x.drawImage(im, (72 - im.naturalWidth * s) / 2, (72 - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); b.appendChild(c); }
      b.addEventListener('click', function () { if (pick[p.id]) delete pick[p.id]; else pick[p.id] = 1; b.classList.toggle('on', !!pick[p.id]); faces().then(relayout); });
      $('#cl-pick').appendChild(b);
    });
  }
  /* faces found once per photo (for the crops); quiet, and only for the chosen ones */
  function faces() { var l = chosen().filter(function (p) { return !p.faces && FS.findFaces; }); return l.reduce(function (ch, p) { return ch.then(function () { return FS.findFaces(p, true).catch(function () {}); }); }, Promise.resolve()); }
  function open() {
    if (!Object.keys(pick).length) { var m = FS.marked(); (m.length > 1 ? m : S.photos.slice(0, 6)).forEach(function (p) { pick[p.id] = 1; }); }
    Object.keys(pick).forEach(function (id) { if (!S.photos.some(function (p) { return p.id === id; })) delete pick[id]; });
    sizes(); thumbs(); relayout(); faces().then(relayout);
  }
  var openTab = FS.openTab; FS.openTab = function (n) { var r = openTab(n); if (n === 'collage') setTimeout(open, 30); return r; };
  $('#cl-all').addEventListener('click', function () { pick = {}; S.photos.slice(0, 40).forEach(function (p) { pick[p.id] = 1; }); thumbs(); faces().then(relayout); relayout(); });
  $('#cl-marked').addEventListener('click', function () { var m = FS.marked(); if (m.length < 2) return FS.toast('מסמנים קודם כמה תמונות בפס התמונות'); pick = {}; m.forEach(function (p) { pick[p.id] = 1; }); thumbs(); faces().then(relayout); relayout(); });
  $$('#cl-mode button').forEach(function (b) { b.addEventListener('click', function () { mode = b.dataset.m; $$('#cl-mode button').forEach(function (x) { x.classList.toggle('on', x === b); }); relayout(); }); });
  ['#cl-size', '#cl-orient', '#cl-title'].forEach(function (s) { $(s).addEventListener('change', function () { if (s === '#cl-size') { FS.prefs.clSize = this.value; FS.savePrefs(); } relayout(); }); });
  $('#cl-title').addEventListener('input', relayout);
  $('#cl-gap').addEventListener('input', function () { $('#o-cl-gap').textContent = this.value + ' מ״מ'; relayout(); });
  $('#cl-rad').addEventListener('input', function () { $('#o-cl-rad').textContent = this.value; draw(); });
  ['#cl-bg', '#cl-ink'].forEach(function (s) { $(s).addEventListener('input', draw); });
  $('#cl-shuffle').addEventListener('click', function () { if (!layouts.length) return; li = (li + 1) % layouts.length; if (li === 0) { seed += 13; layouts = FS.collageLayouts(ars(), opts().boxW, opts().boxH, opts().gap, mode, seed); } draw(); });
  $('#cl-make').addEventListener('click', function () {
    var l = chosen(); if (l.length < 2 || !layouts.length) return FS.toast('בוחרים לפחות 2 תמונות');
    var o = opts(), k = 300 / 25.4; FS.busy('מכין קולאז׳ באיכות הדפסה…');
    setTimeout(function () {
      var c = FS.drawCollage(l, layouts[li], o, k);
      c.toBlob(function (b) {
        var file = new File([b], 'קולאז׳ ' + l.length + ' תמונות.jpg', { type: 'image/jpeg' });
        FS.addPhotoFile(file).then(function (p) {
          FS.applyFormat(p.doc, 'cm', FS.img(p.src), o.W, o.H); p.doc.frame = null; p.doc.layers = []; FS.fitPhoto(p.doc, FS.img(p.src)); p.collage = true; FS.snap(p);
          FS.busy(); FS.buildStrip(); FS.select(S.photos.indexOf(p)); FS.toast('🧩 הקולאז׳ נוסף כדף חדש. אפשר להדפיס, לשמור או להוסיף מסגרת.', 5000);
        }, function () { FS.busy(); FS.toast('לא הצלחתי ליצור את הקולאז׳'); });
      }, 'image/jpeg', 0.93);
    }, 40);
  });
})();
