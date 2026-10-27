/* The frame editor (עורך מסגרות, Oct 27): a professional frame for the event, from its invitation, in the program.
   - Examples: the invitation's file makes ready designs on this computer (js/inv-frame.js): the invitation itself as the
     magnet with a window at its quietest place (round, oval, arch), the invitation's border rebuilt around the photo, and
     designs in the invitation's colours (paper, accent, ink: FS.invitePalette) with corners, flourishes and the names.
     "🤖 בעיצוב ההזמנה" asks the image AI for a new frame in the same style; "קריאת ההזמנה" reads the names, the date and the
     ornaments (FS.readInvite), and each ornament becomes a piece to place (FS.cutPiece).
   - Editing: every element (ornament, text, piece, picture) is moved by dragging, sized by its round handle or the wheel,
     turned with Shift+wheel; the bar over the stage colours, fades, turns, mirrors, duplicates, layers and deletes it
     (Delete, Ctrl+D, Ctrl+Z, arrows). The background, the window (place, shape, corners) and its line are set in a tab.
   - Saving: to "המסגרות שלי" (FS.addUserFrame, used at once in the studio and the workspace), and to a folder the owner
     picks once (remembered, File System Access): name.png, the frame, and name.optimus-frame.json, the design to open and
     edit again. The last designs are also kept in this browser (IndexedDB 'fs-frame-maker').
   FS.frameMaker.open(). */
(function () {
  'use strict';
  var FS = window.FS; if (!FS) return;
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = FS.esc || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var SIZES = [['10x15', 'עומד 10×15', 100, 150], ['15x10', 'שוכב 15×10', 150, 100], ['13x18', 'עומד 13×18', 130, 180], ['18x13', 'שוכב 18×13', 180, 130], ['15x20', 'עומד 15×20', 150, 200], ['10x10', 'ריבוע 10×10', 100, 100], ['m69', 'מגנט 6×9', 60, 90]];
  function px(mm) { return Math.round(mm / 25.4 * 300); }
  function sizeOf(id) { var s = SIZES.filter(function (x) { return x[0] === id; })[0] || SIZES[0]; return { id: s[0], W: px(s[2]), H: px(s[3]) }; }
  var GOLD = { paper: '#FBF7EF', accent: '#B8904F', ink: '#3A2E1F' };

  /* ---------- the design ---------- */
  var D = null, inv = null, invSrc = '', pal = GOLD, read = null, pieces = [], sel = null, hist = [], fut = [], photo = null, showPhoto = true, cache = {};
  function blank() { return { id: 'f' + FS.uid(), name: 'מסגרת חדשה', size: '10x15', bg: { color: GOLD.paper, src: '', gen: null }, win: { x: 0.09, y: 0.07, w: 0.82, h: 0.7 }, shape: 'round', radius: 0.03, line: { color: GOLD.accent, w: 0.004, double: false }, els: [] }; }
  function snap() { hist.push(JSON.stringify(D)); if (hist.length > 60) hist.shift(); fut = []; }
  function undo() { if (!hist.length) return; fut.push(JSON.stringify(D)); D = JSON.parse(hist.pop()); sel = null; ui(); draw(); }
  function redo() { if (!fut.length) return; hist.push(JSON.stringify(D)); D = JSON.parse(fut.pop()); sel = null; ui(); draw(); }

  /* the window's outline (shape: rect, round, oval, arch), inset by t */
  function winPath(x, shape, hx, hy, hw, hh, r, t) {
    t = t || 0; hx += t; hy += t; hw -= 2 * t; hh -= 2 * t; x.beginPath();
    if (shape === 'oval') x.ellipse(hx + hw / 2, hy + hh / 2, Math.max(1, hw / 2), Math.max(1, hh / 2), 0, 0, Math.PI * 2);
    else if (shape === 'arch') { var rr = hw / 2, top = hy + Math.min(rr, hh); x.moveTo(hx, hy + hh); x.lineTo(hx, top); x.arc(hx + rr, top, rr, Math.PI, 0); x.lineTo(hx + hw, hy + hh); x.closePath(); }
    else FS.roundRect(x, hx, hy, hw, hh, shape === 'round' ? Math.max(0, r) : 0);
  }
  /* an element's picture (cached by what it shows) */
  function elCanvas(e) {
    var k = e.t + '|' + (e.t === 'orn' ? e.key + e.color : e.t === 'text' ? [e.text, e.font, e.color, e.weight, e.stroke, e.sw, e.ls, e.italic].join('|') : e.src.length + e.src.slice(-40));
    if (cache[k]) return cache[k];
    if (e.t === 'orn') return (cache[k] = FS.elementCanvas(e.key, e.color));
    if (e.t === 'text') return (cache[k] = textCv(e));
    var im = FS.img(e.src); if (!im) { FS.loadImg(e.src).then(draw, function () {}); return null; }
    return (cache[k] = im);
  }
  /* a line of text: font, colour, weight, italic, an outline (e.stroke, e.sw as a share of the letters) and spacing (e.ls, em) */
  function textCv(e) {
    var size = 160, f = (e.italic ? 'italic ' : '') + (e.weight || 700) + ' ' + size + 'px "' + (e.font || 'Heebo') + '", Heebo, sans-serif', sw = e.stroke ? Math.max(2, (e.sw || 0.06) * size) : 0;
    var m = FS.canvas(4, 4).getContext('2d'); m.font = f; if ('letterSpacing' in m) m.letterSpacing = (e.ls || 0) * size + 'px';
    var c = FS.canvas(Math.max(40, Math.ceil(m.measureText(e.text || ' ').width + sw * 2 + 40)), Math.round(size * 1.45 + sw * 2)), x = c.getContext('2d');
    x.font = f; if ('letterSpacing' in x) x.letterSpacing = (e.ls || 0) * size + 'px'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.lineJoin = 'round';
    if (sw) { x.strokeStyle = e.stroke; x.lineWidth = sw; x.strokeText(e.text || ' ', c.width / 2, c.height / 2); }
    x.fillStyle = e.color || '#1d1633'; x.fillText(e.text || ' ', c.width / 2, c.height / 2); return c;
  }
  function elBox(e, W, H) { var c = elCanvas(e); if (!c) return null; var w = e.w * W, h = w * (c.naturalHeight || c.height) / (c.naturalWidth || c.width); return { c: c, cx: e.x * W, cy: e.y * H, w: w, h: h }; }
  /* the background made from the invitation, rebuilt for the size asked (or the saved picture, cover-fit) */
  function base(W, H) {
    var g = D.bg.gen, k = 'base|' + W + 'x' + H + '|' + JSON.stringify(g) + '|' + (D.bg.src || '').length;
    if (cache[k]) return cache[k];
    var out = null;
    if (g && inv) {
      if (g.fn === 'magnet') { var r = FS.inviteAsMagnet(inv, W, H, g.rect, g.shape, g.edge); out = { c: r.canvas, win: { x: r.hole.x / W, y: r.hole.y / H, w: r.hole.w / W, h: r.hole.h / H } }; }
      else if (g.fn === 'border') { var b = FS.frameFromInvite(inv, W, H, g.o); out = { c: b.canvas, win: { x: b.window.x / W, y: b.window.y / H, w: b.window.w / W, h: b.window.h / H } }; }
      else if (g.fn === 'cover') { var c = FS.canvas(W, H), x = c.getContext('2d'), iw = inv.naturalWidth, ih = inv.naturalHeight, s = Math.max(W / iw, H / ih); x.imageSmoothingQuality = 'high'; x.drawImage(inv, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s); out = { c: c }; }
    } else if (D.bg.src) {
      var im = FS.img(D.bg.src); if (!im) { FS.loadImg(D.bg.src).then(draw, function () {}); return null; }
      var c2 = FS.canvas(W, H), x2 = c2.getContext('2d'), s2 = Math.max(W / im.naturalWidth, H / im.naturalHeight); x2.imageSmoothingQuality = 'high';
      x2.drawImage(im, (W - im.naturalWidth * s2) / 2, (H - im.naturalHeight * s2) / 2, im.naturalWidth * s2, im.naturalHeight * s2); out = { c: c2 };
    }
    return (cache[k] = out);
  }
  /* the frame at W×H: background, the elements set behind the photo, the line around the window, the window cut
     see-through (it also cuts what is behind the photo), then the elements in front of the photo */
  function render(W, H, withPhoto) {
    var c = FS.canvas(W, H), x = c.getContext('2d'), M = Math.min(W, H), b = base(W, H);
    if (b && b.win && D.bg.gen && D.bg.gen.fn !== 'cover') D.win = b.win;
    var w = D.win, hx = w.x * W, hy = w.y * H, hw = w.w * W, hh = w.h * H, r = D.radius * M;
    x.fillStyle = D.bg.color || '#ffffff'; x.fillRect(0, 0, W, H);
    if (b) { x.imageSmoothingQuality = 'high'; x.drawImage(b.c, 0, 0, W, H); if (D.bg.dim) { x.fillStyle = 'rgba(0,0,0,' + D.bg.dim + ')'; x.fillRect(0, 0, W, H); } }
    function els(under) {
      D.els.forEach(function (e) {
        if (!!e.under !== under) return; var bx = elBox(e, W, H); if (!bx) return;
        x.save(); x.globalAlpha = e.op == null ? 1 : e.op; x.translate(bx.cx, bx.cy); x.rotate((e.rot || 0) * Math.PI / 180); if (e.flip) x.scale(-1, 1);
        if (e.shadow) { x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = M * 0.01; x.shadowOffsetY = M * 0.003; }
        x.drawImage(bx.c, -bx.w / 2, -bx.h / 2, bx.w, bx.h); x.restore();
      });
    }
    els(true);
    if (D.line && D.line.w > 0) {
      x.save(); x.strokeStyle = D.line.color; x.lineWidth = Math.max(1, D.line.w * M);
      winPath(x, D.shape, hx, hy, hw, hh, r, -D.line.w * M * 1.4); x.stroke();
      if (D.line.double) { x.lineWidth = Math.max(1, D.line.w * M * 0.5); winPath(x, D.shape, hx, hy, hw, hh, r, -D.line.w * M * 4.2); x.stroke(); }
      x.restore();
    }
    x.save(); x.globalCompositeOperation = 'destination-out'; winPath(x, D.shape, hx, hy, hw, hh, r); x.fill(); x.restore();
    els(false);
    if (!withPhoto || !photo) return c;
    var o = FS.canvas(W, H), ox = o.getContext('2d'), s = Math.max(hw / photo.naturalWidth, hh / photo.naturalHeight);
    ox.fillStyle = '#222'; ox.fillRect(0, 0, W, H); ox.imageSmoothingQuality = 'high';
    ox.drawImage(photo, hx + (hw - photo.naturalWidth * s) / 2, hy + (hh - photo.naturalHeight * s) / 2, photo.naturalWidth * s, photo.naturalHeight * s);
    ox.drawImage(c, 0, 0); return o;
  }

  /* ---------- examples from the invitation (or in gold and ivory before there is one) ---------- */
  function textEls(p, y, big) {
    var out = [], names = (read && read.names) || $('#fm-names', root).value.trim(), date = (read && read.date ? read.date.split('-').reverse().join('.') : '') || $('#fm-date', root).value.trim(), font = (read && read.font && FS.fontFor) ? FS.fontFor(read.font) : 'Frank Ruhl Libre';
    if (names) out.push({ id: FS.uid(), t: 'text', text: names, font: font, color: p.ink, weight: 700, x: 0.5, y: y, w: big || 0.62, rot: 0 });
    if (date) out.push({ id: FS.uid(), t: 'text', text: date, font: 'Heebo', color: p.accent, weight: 500, x: 0.5, y: y + 0.055, w: 0.22, rot: 0 });
    return out;
  }
  function orn(key, color, x, y, w, rot, flip) { return { id: FS.uid(), t: 'orn', key: key, color: color, x: x, y: y, w: w, rot: rot || 0, flip: !!flip }; }
  function corners(color, w, m, my) { my = my || m; return [orn('corner', color, m, my, w, 0), orn('corner', color, 1 - m, my, w, 90), orn('corner', color, 1 - m, 1 - my, w, 180), orn('corner', color, m, 1 - my, w, 270)]; }
  function examples() {
    var p = pal, list = [], ar = sizeOf(D ? D.size : '10x15'), aspect = ar.W / ar.H;
    if (inv) {
      var rect = FS.invSmartWindow(inv, aspect * 0.95, 0.4);
      list.push(['ההזמנה עצמה · חלון מעוגל', { bg: { color: p.paper, src: '', gen: { fn: 'magnet', rect: rect, shape: 'round', edge: 'line' } }, shape: 'round', radius: 0.03, line: { color: p.accent, w: 0 }, els: [] }]);
      list.push(['ההזמנה עצמה · אליפסה', { bg: { color: p.paper, src: '', gen: { fn: 'magnet', rect: rect, shape: 'oval', edge: 'double' } }, shape: 'oval', radius: 0, line: { color: p.accent, w: 0 }, els: [] }]);
      list.push(['ההזמנה עצמה · קשת', { bg: { color: p.paper, src: '', gen: { fn: 'magnet', rect: rect, shape: 'arch', edge: 'mat' } }, shape: 'arch', radius: 0, line: { color: p.accent, w: 0 }, els: [] }]);
      list.push(['גבול ההזמנה', { bg: { color: p.paper, src: '', gen: { fn: 'border', o: { border: 0.17, band: 0.12, text: 0.13, accent: p.accent } } }, shape: 'round', radius: 0.025, line: { color: p.accent, w: 0 }, els: textEls(p, 0.875) }]);
      list.push(['גבול עדין', { bg: { color: p.paper, src: '', gen: { fn: 'border', o: { border: 0.12, band: 0.075, text: 0.1, accent: p.accent } } }, shape: 'round', radius: 0.02, line: { color: p.accent, w: 0 }, els: textEls(p, 0.9) }]);
      list.push(['ההזמנה כרקע', { bg: { color: p.paper, src: '', gen: { fn: 'cover' }, dim: 0.06 }, win: { x: 0.1, y: 0.08, w: 0.8, h: 0.68 }, shape: 'round', radius: 0.03, line: { color: '#ffffff', w: 0.006, double: true }, els: textEls({ ink: '#ffffff', accent: '#ffffff' }, 0.86).map(function (e) { e.shadow = true; return e; }) }]);
    }
    list.push(['פינות מעוטרות', { bg: { color: p.paper, src: '', gen: null }, win: { x: 0.11, y: 0.085, w: 0.78, h: 0.68 }, shape: 'rect', radius: 0, line: { color: p.accent, w: 0.004, double: true }, els: corners(p.accent, 0.16, 0.085, 0.06).concat([orn('divider', p.accent, 0.5, 0.835, 0.4)], textEls(p, 0.88)) }]);
    list.push(['מינימלי יוקרתי', { bg: { color: p.paper, src: '', gen: null }, win: { x: 0.07, y: 0.05, w: 0.86, h: 0.74 }, shape: 'round', radius: 0.012, line: { color: p.accent, w: 0.0025 }, els: [orn('flourish', p.accent, 0.5, 0.83, 0.3)].concat(textEls(p, 0.885, 0.56)) }]);
    list.push(['פרחוני', { bg: { color: p.paper, src: '', gen: null }, win: { x: 0.1, y: 0.1, w: 0.8, h: 0.66 }, shape: 'arch', radius: 0, line: { color: p.accent, w: 0.004 }, els: [orn('leaves', p.accent, 0.2, 0.06, 0.34, -12), orn('leaves', p.accent, 0.8, 0.06, 0.34, 12, true), orn('flower', p.accent, 0.5, 0.045, 0.08), orn('hearts', p.accent, 0.5, 0.8, 0.07)].concat(textEls(p, 0.87)) }]);
    list.push(['כהה מוזהב', { bg: { color: '#16130E', src: '', gen: null }, win: { x: 0.08, y: 0.06, w: 0.84, h: 0.72 }, shape: 'round', radius: 0.02, line: { color: '#D9B677', w: 0.004, double: true }, els: corners('#D9B677', 0.13, 0.07, 0.05).concat([orn('sparkle', '#F3DDA6', 0.5, 0.82, 0.05)], textEls({ ink: '#F3DDA6', accent: '#D9B677' }, 0.875)) }]);
    list.push(['פולארויד', { bg: { color: '#FFFFFF', src: '', gen: null }, win: { x: 0.06, y: 0.045, w: 0.88, h: 0.76 }, shape: 'rect', radius: 0, line: { color: '#e9e4da', w: 0.002 }, els: textEls({ ink: '#2b2b2b', accent: '#8a8a8a' }, 0.88).map(function (e) { if (e.weight === 700) e.font = 'Amatic SC'; return e; }) }]);
    return list;
  }
  function useExample(d) { snap(); var keep = { id: D.id, name: D.name, size: D.size }; D = Object.assign(blank(), JSON.parse(JSON.stringify(d)), keep); if (!D.win) D.win = blank().win; sel = null; cache = {}; ui(); draw(); tab('els'); }
  function buildExamples() {
    var box = $('#fm-ex', root); if (!box) return;
    var list = examples(), s = sizeOf(D.size), tw = 200, th = Math.round(tw * s.H / s.W), keep = D;
    box.innerHTML = list.map(function (e, i) { return '<button class="fm-exb" data-ex="' + i + '"><canvas width="' + tw + '" height="' + th + '"></canvas><span>' + esc(e[0]) + '</span></button>'; }).join('');
    var i = 0;
    (function step() {
      var t0 = performance.now();
      try {
        while (i < list.length && performance.now() - t0 < 30) {
          D = Object.assign(blank(), JSON.parse(JSON.stringify(list[i][1])), { size: keep.size }); if (!D.win) D.win = blank().win;
          var cv = box.querySelectorAll('canvas')[i++]; if (cv) cv.getContext('2d').drawImage(render(s.W / 3 | 0, s.H / 3 | 0, showPhoto), 0, 0, cv.width, cv.height);
        }
      } catch (e) { if (window.console) console.warn('frame example', e); } finally { D = keep; }
      if (i < list.length && box.isConnected) requestAnimationFrame(step);
    })();
    box.onclick = function (e) { var b = e.target.closest('[data-ex]'); if (b) useExample(list[Number(b.dataset.ex)][1]); };
    aiCards();
  }

  /* ---------- ten frames the image AI designs from the invitation, standing, lying or both ----------
     Each one gets its own design direction (FS.invFramePrompt's o.extra), three are asked at a time, and every card shows
     its frame the moment it is back; a card that failed is asked again on a click. The results stay while the program is open. */
  var AI_DIRS = [
    ['קלאסית מעוטרת', 'classic and ornate, the invitation\'s ornaments repeated richly along all four edges', { band: true, round: true, hole: 0.7 }],
    ['מינימלית יוקרתית', 'minimal and luxurious: a fine double line in the invitation\'s accent colour, lots of calm paper, one small ornament at the top', { hole: 0.78 }],
    ['פרחונית', 'floral: generous flowers and leaves from the invitation gathered in two opposite corners, the rest light', { band: true, hole: 0.7 }],
    ['זהב וארט דקו', 'gold foil Art Deco: geometric gold lines and corner fans, elegant and festive', { hole: 0.72 }],
    ['צבעי מים', 'soft watercolour washes in the invitation\'s colours, painted edges that fade into the paper', { round: true, hole: 0.72 }],
    ['רצועת שמות רחבה', 'a wide decorated band at the bottom for the names, a slimmer border on the other sides', { band: true, hole: 0.66 }],
    ['חלון קשת', 'an arched window (round top) framed by an ornamental arch in the invitation\'s style', { hole: 0.68 }],
    ['חלון אליפסה', 'an oval window surrounded by a wreath of the invitation\'s ornaments', { hole: 0.6 }],
    ['בוטנית ירוקה', 'botanical: leafy greenery and branches climbing up the sides, fresh and natural', { band: true, hole: 0.7 }],
    ['חגיגית מנצנצת', 'festive and glowing: fine sparkles, confetti of the invitation\'s colours and a soft shimmer around the window', { round: true, hole: 0.72 }]
  ];
  var aiEx = [], aiOr = 'p', aiRun = 0;
  function portraitSize() { var s = sizeOf(D.size); return s.H >= s.W ? D.size : '10x15'; }
  function landscapeSize() { var s = sizeOf(D.size); return s.W > s.H ? D.size : '15x10'; }
  function aiCards() {
    var box = $('#fm-aiex', root); if (!box) return;
    box.innerHTML = aiEx.map(function (j, i) {
      var s = sizeOf(j.size), tw = 200, th = Math.round(tw * s.H / s.W);
      return '<button class="fm-exb fm-aij ' + j.st + '" data-aj="' + i + '"><canvas width="' + tw + '" height="' + th + '"></canvas><span>' + esc(j.name) + ' · ' + (s.W > s.H ? 'שוכבת' : 'עומדת') + '</span>' +
        (j.st === 'wait' ? '<em>🤖 מעצב…</em>' : j.st === 'err' ? '<em>⚠ לא הצליח · לחיצה לנסות שוב</em>' : '') + '</button>';
    }).join('');
    $$('[data-aj]', box).forEach(function (b) { var j = aiEx[Number(b.dataset.aj)]; if (j.st === 'ok') aiThumb(j, b.querySelector('canvas')); });
  }
  function aiThumb(j, cv) {
    FS.loadImg(j.src).then(function (im) {
      var x = cv.getContext('2d'), w = j.win, W = cv.width, H = cv.height;
      if (photo) { var hx = w.x * W, hy = w.y * H, hw = w.w * W, hh = w.h * H, s = Math.max(hw / photo.naturalWidth, hh / photo.naturalHeight); x.drawImage(photo, hx + (hw - photo.naturalWidth * s) / 2, hy + (hh - photo.naturalHeight * s) / 2, photo.naturalWidth * s, photo.naturalHeight * s); }
      x.drawImage(im, 0, 0, W, H);
    }, function () {});
  }
  function aiJob(j) {
    var s = sizeOf(j.size), dir = AI_DIRS[j.k]; j.st = 'wait'; aiCards();
    return FS.aiFrameFromInvite(inv, s.W, s.H, Object.assign({ extra: dir[1] }, dir[2])).then(function (r) {
      j.src = r.canvas.toDataURL('image/png'); j.win = { x: r.hole.x / s.W, y: r.hole.y / s.H, w: r.hole.w / s.W, h: r.hole.h / s.H }; j.st = 'ok';
    }, function (e) { j.st = 'err'; j.err = e && e.message; }).then(aiCards);
  }
  function ai10() {
    if (!inv) return FS.toast('מעלים קודם את ההזמנה');
    if (aiRun) { aiRun++; if (FS.aiStop) FS.aiStop(); return; }
    var sizes = aiOr === 'p' ? [portraitSize()] : aiOr === 'l' ? [landscapeSize()] : [portraitSize(), landscapeSize()], jobs = [];
    sizes.forEach(function (sz) { AI_DIRS.forEach(function (d, k) { jobs.push({ k: k, name: d[0], size: sz, st: 'wait' }); }); });
    aiEx = jobs.concat(aiEx.filter(function (j) { return j.st === 'ok'; })); aiCards();
    var next = 0, run = ++aiRun; $('#fm-ai10', root).textContent = '⏹ עצירה';
    function lane() { if (run !== aiRun || next >= jobs.length) return Promise.resolve(); var j = jobs[next++]; return aiJob(j).then(lane); }
    Promise.all([lane(), lane(), lane()]).then(function () {
      aiRun = 0; $('#fm-ai10', root).textContent = '🤖 10 מסגרות AI'; jobs.forEach(function (j) { if (j.st === 'wait') j.st = 'err'; }); aiCards();
      var ok = jobs.filter(function (j) { return j.st === 'ok'; }).length, bad = jobs.length - ok;
      FS.toast('🤖 ' + ok + ' מסגרות AI מוכנות' + (bad ? ' · ' + bad + ' לא הצליחו (לחיצה על כרטיס מנסה שוב)' + (FS.lastAiDetail ? '' : '') : '') + '. בוחרים אחת ועורכים.', 7000);
    });
  }
  function useAI(j) {
    snap(); D.size = j.size; D.bg = { color: pal.paper, src: j.src, gen: null }; D.win = j.win; D.shape = 'rect'; D.radius = 0; D.line = { color: pal.accent, w: 0 };
    D.els = textEls(pal, Math.min(0.94, D.win.y + D.win.h + (1 - D.win.y - D.win.h) / 2 - 0.02)); sel = null; cache = {}; ui(); draw(); tab('els');
    FS.toast('🤖 "' + j.name + '" בעורך. אפשר להוסיף, להזיז, לשנות טקסטים ולשמור.');
  }
  function loadInvite(file) {
    FS.fileToDataURL(file).then(function (u) { return FS.loadImg(u).then(function (im) { inv = im; invSrc = u; }); }).then(function () {
      var P = FS.invitePalette ? FS.invitePalette(inv, 6) : [], acc = FS.accentOf ? FS.accentOf(P) : GOLD.accent;
      var dark = P.slice().sort(function (a, b) { return lumH(a) - lumH(b); })[0];
      pal = { paper: P[0] || GOLD.paper, accent: acc, ink: dark && lumH(dark) < 110 ? dark : GOLD.ink };
      D.inv = invSrc; read = null; pieces = []; cache = {}; $('#fm-inv-img', root).src = invSrc; root.classList.add('has-inv');
      buildExamples(); buildPieces(); FS.toast('✨ ההזמנה נטענה · בוחרים דוגמה');
    }, function () { FS.toast('ההזמנה לא נפתחה. צריך קובץ תמונה (JPG / PNG)'); });
  }
  function lumH(h) { var c = FS.hexRgb ? FS.hexRgb(h) : [128, 128, 128]; return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
  function readInvite() {
    if (!inv || !FS.readInvite) return;
    FS.busy('🤖 קורא את ההזמנה: שמות, תאריך וקישוטים…');
    FS.readInvite(inv).then(function (r) {
      FS.busy(); read = r;
      if (r.names) $('#fm-names', root).value = r.names; if (r.date) $('#fm-date', root).value = r.date.split('-').reverse().join('.');
      pieces = (r.ornaments || []).map(function (o) { try { var c = FS.cutPiece(inv, o.box); return c ? { label: o.label, src: (c.canvas || c).toDataURL('image/png') } : null; } catch (e) { return null; } }).filter(Boolean);
      buildPieces(); buildExamples(); FS.toast('✔ נקראו ' + (r.names ? 'השמות, ' : '') + pieces.length + ' קישוטים מההזמנה');
    }, function (e) { FS.busy(); FS.toast('ההזמנה לא נקראה. ' + (FS.aiError ? FS.aiError(e && e.message) : ''), 6000); });
  }

  /* ---------- the window ---------- */
  var root = document.createElement('div'); root.id = 'fm'; root.hidden = true; root.setAttribute('dir', 'rtl');
  var fonts = (FS.FONTS || []).map(function (f) { return '<option value="' + esc(f[0]) + '">' + esc(f[1]) + '</option>'; }).join('');
  root.innerHTML =
    '<header class="fm-top"><b class="fm-title">🖼️ עורך מסגרות</b><input id="fm-name" maxlength="60" placeholder="שם המסגרת">' +
      '<select id="fm-size">' + SIZES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select>' +
      '<span class="fm-sp"></span><button class="fm-btn" id="fm-undo" title="Ctrl+Z">↶</button><button class="fm-btn" id="fm-redo" title="Ctrl+Y">↷</button>' +
      '<label class="fm-btn">📂 פתיחה<input type="file" id="fm-open" accept=".json,application/json" hidden></label>' +
      '<button class="fm-btn" id="fm-dir" title="התיקייה שבה נשמרות המסגרות">📁 <span id="fm-dirn">בחירת תיקייה</span></button>' +
      '<button class="fm-btn gold" id="fm-save">💾 שמירה</button><button class="fm-btn" id="fm-close" title="סגירה (Esc)">✕</button></header>' +
    '<div class="fm-body"><aside class="fm-side"><nav class="fm-tabs"><button data-t="ex" class="on">✨ דוגמאות</button><button data-t="els">🌿 אלמנטים</button><button data-t="txt">🔤 טקסט</button><button data-t="bg">🎨 רקע וחלון</button></nav>' +
      '<section data-p="ex"><div class="fm-inv"><img id="fm-inv-img" alt=""><div><label class="fm-btn gold">📨 העלאת ההזמנה<input type="file" id="fm-inv" accept="image/*" hidden></label><button class="fm-btn" id="fm-read">🤖 קריאת ההזמנה</button><p class="fm-hint">הדוגמאות נבנות מההזמנה: הצבעים, הגבול, הקישוטים והשמות.</p></div></div>' +
        '<div class="fm-row"><input id="fm-names" placeholder="שמות, למשל: נועה ודניאל"><input id="fm-date" placeholder="תאריך" style="max-width:120px"></div><button class="fm-btn" id="fm-reex">↻ עדכון הדוגמאות</button>' +
        '<h4>🤖 מסגרות שה־AI עיצב מההזמנה</h4><p class="fm-hint">עשר מסגרות שונות בסגנון ההזמנה, כל אחת בכיוון אחר: קלאסית, מינימלית, פרחונית, זהב, צבעי מים ועוד. כל מסגרת מופיעה כשהיא מוכנה, ואז אפשר לערוך אותה.</p>' +
        '<div class="fm-row"><div class="fm-seg fm-or" id="fm-aior"><button data-o="p" class="on">עומדות</button><button data-o="l">שוכבות</button><button data-o="b">שתיהן</button></div><button class="fm-btn gold" id="fm-ai10">🤖 10 מסגרות AI</button></div><div class="fm-ex" id="fm-aiex"></div>' +
        '<h4>✨ דוגמאות מוכנות</h4><div class="fm-ex" id="fm-ex"></div><h4>העיצובים שלי</h4><div class="fm-mine" id="fm-mine"></div></section>' +
      '<section data-p="els" hidden><div class="fm-row"><label>צבע</label><input type="color" id="fm-ecol" value="#B8904F"><button class="fm-btn" id="fm-epal" title="צבעי ההזמנה">🎨</button><span class="fm-pal" id="fm-pal"></span></div><div class="fm-orn" id="fm-orn"></div>' +
        '<h4>מההזמנה</h4><div class="fm-orn" id="fm-pieces"></div><div class="fm-row"><button class="fm-btn" id="fm-crop">✂️ חיתוך חלק מההזמנה</button><label class="fm-btn">🖼️ תמונה / לוגו<input type="file" id="fm-img" accept="image/*" hidden></label></div></section>' +
      '<section data-p="txt" hidden><input id="fm-tt" placeholder="הטקסט"><div class="fm-row"><select id="fm-tf">' + fonts + '</select><input type="color" id="fm-tc" value="#3A2E1F"></div>' +
        '<div class="fm-row"><label class="fm-chk"><input type="checkbox" id="fm-tb" checked> מודגש</label><label class="fm-chk"><input type="checkbox" id="fm-ti"> נטוי</label><label class="fm-chk"><input type="checkbox" id="fm-ts"> צל</label></div>' +
        '<div class="fm-row"><label class="fm-chk"><input type="checkbox" id="fm-to"> קו מתאר</label><input type="color" id="fm-toc" value="#ffffff"><label class="fm-l" style="flex:1">עובי <input type="range" id="fm-tow" min="2" max="20" value="6"></label></div>' +
        '<label class="fm-l">ריווח אותיות <input type="range" id="fm-tls" min="-5" max="60" value="0"></label>' +
        '<button class="fm-btn gold" id="fm-tadd">➕ הוספת טקסט</button><p class="fm-hint">טקסט מסומן משתנה ישר מכאן. לחיצה כפולה על טקסט במסגרת פותחת אותו לעריכה.</p>' +
        '<div class="fm-row fm-quick"><button class="fm-btn" data-q="names">השמות</button><button class="fm-btn" data-q="date">התאריך</button><button class="fm-btn" data-q="tag">#האשטאג</button><button class="fm-btn" data-q="thanks">תודה שבאתם</button><button class="fm-btn" data-q="mazal">מזל טוב</button></div>' +
        '<h4>כל הטקסטים במסגרת</h4><div class="fm-tlist" id="fm-tlist"></div></section>' +
      '<section data-p="bg" hidden><div class="fm-row"><label>צבע הרקע</label><input type="color" id="fm-bgc"><label class="fm-btn">🖼️ תמונת רקע<input type="file" id="fm-bgi" accept="image/*" hidden></label><button class="fm-btn" id="fm-bginv">📨 ההזמנה כרקע</button><button class="fm-btn" id="fm-bgx">✕</button></div>' +
        '<label class="fm-l">הכהיית הרקע <input type="range" id="fm-dim" min="0" max="60"></label>' +
        '<h4>החלון של התמונה</h4><div class="fm-seg" id="fm-shape"><button data-s="rect">ישר</button><button data-s="round">מעוגל</button><button data-s="oval">אליפסה</button><button data-s="arch">קשת</button></div>' +
        '<label class="fm-l">שוליים בצדדים <input type="range" id="fm-wx" min="0" max="30"></label><label class="fm-l">למעלה <input type="range" id="fm-wy" min="0" max="30"></label><label class="fm-l">למטה (מקום לשמות) <input type="range" id="fm-wb" min="0" max="40"></label><label class="fm-l">עיגול פינות <input type="range" id="fm-wr" min="0" max="12"></label>' +
        '<h4>קו סביב החלון</h4><div class="fm-row"><input type="color" id="fm-lc"><label class="fm-l" style="flex:1">עובי <input type="range" id="fm-lw" min="0" max="20"></label><label class="fm-chk"><input type="checkbox" id="fm-ld"> כפול</label></div></section>' +
    '</aside><main class="fm-stage" id="fm-stage"><div class="fm-selbar" id="fm-selbar" hidden><input type="color" id="fm-scol" title="צבע"><label title="שקיפות">◐<input type="range" id="fm-sop" min="10" max="100"></label>' +
        '<button data-s="small" title="הקטנה">−</button><button data-s="big" title="הגדלה">+</button><button data-s="rl" title="סיבוב">⟲</button><button data-s="rr" title="סיבוב">⟳</button><button data-s="flip" title="היפוך">⇋</button><button data-s="dup" title="שכפול (Ctrl+D)">⧉</button><button data-s="layer" class="fm-lay" title="לפני או מאחורי התמונה">⇅</button><button data-s="up" title="קדימה">⬆</button><button data-s="down" title="אחורה">⬇</button><button data-s="del" class="danger" title="מחיקה (Delete)">🗑</button></div>' +
      '<canvas id="fm-cv"></canvas><div class="fm-foot"><label class="fm-chk"><input type="checkbox" id="fm-ph" checked> תמונה לדוגמה בחלון</label><span class="fm-hint">גוררים כדי להזיז · העיגול בפינה משנה גודל · גלגלת: גודל · Shift+גלגלת: סיבוב</span></div></main></div>';
  document.body.appendChild(root);

  var cv = $('#fm-cv', root), ck = 1;
  function draw() {
    if (root.hidden || !D) return;
    var s = sizeOf(D.size), st = $('#fm-stage', root), bw = Math.max(200, st.clientWidth - 40), bh = Math.max(200, st.clientHeight - 110);
    ck = Math.min(bw / s.W, bh / s.H); var dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(s.W * ck), H = Math.round(s.H * ck);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var x = cv.getContext('2d'), img = render(Math.round(W * dpr), Math.round(H * dpr), showPhoto);
    x.clearRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0);
    var e = selEl(); $('#fm-selbar', root).hidden = !e;
    if (e) {
      var b = elBox(e, cv.width, cv.height); if (!b) return;
      x.save(); x.translate(b.cx, b.cy); x.rotate((e.rot || 0) * Math.PI / 180); x.strokeStyle = '#D9B677'; x.lineWidth = 1.5 * dpr; x.setLineDash([6 * dpr, 4 * dpr]); x.strokeRect(-b.w / 2 - 4, -b.h / 2 - 4, b.w + 8, b.h + 8);
      x.setLineDash([]); x.fillStyle = '#D9B677'; x.beginPath(); x.arc(b.w / 2 + 4, b.h / 2 + 4, 9 * dpr, 0, 7); x.fill(); x.restore();
      $('.fm-lay', root).classList.toggle('on', !!e.under); $('.fm-lay', root).title = e.under ? 'מאחורי התמונה · לחיצה מעבירה לפני התמונה' : 'לפני התמונה · לחיצה מעבירה מאחורי התמונה';
      $('#fm-scol', root).value = /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : '#ffffff'; $('#fm-scol', root).disabled = e.t === 'img'; $('#fm-sop', root).value = Math.round((e.op == null ? 1 : e.op) * 100);
    }
  }
  function selEl() { return sel && D.els.filter(function (e) { return e.id === sel; })[0]; }
  /* where on the frame (0..1), and what is there */
  function at(ev) { var r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }; }
  function local(e, p) { var W = cv.width, H = cv.height, b = elBox(e, W, H); if (!b) return null; var dx = p.x * W - b.cx, dy = p.y * H - b.cy, a = -(e.rot || 0) * Math.PI / 180; return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a), b: b }; }
  function hit(p) { for (var i = D.els.length - 1; i >= 0; i--) { var l = local(D.els[i], p); if (l && Math.abs(l.x) <= l.b.w / 2 + 6 && Math.abs(l.y) <= l.b.h / 2 + 6) return D.els[i]; } return null; }
  var drag = null;
  cv.addEventListener('pointerdown', function (ev) {
    var p = at(ev), e = selEl(), l = e && local(e, p), dpr = cv.width / cv.getBoundingClientRect().width;
    if (l && Math.hypot(l.x - (l.b.w / 2 + 4), l.y - (l.b.h / 2 + 4)) < 16 * dpr) { snap(); drag = { k: 'size', e: e, w0: e.w, d0: Math.hypot(l.x, l.y) }; }
    else { var h = hit(p); sel = h ? h.id : null; if (h) { snap(); drag = { k: 'move', e: h, ox: p.x - h.x, oy: p.y - h.y }; syncText(); } }
    if (drag) cv.setPointerCapture(ev.pointerId); draw();
  });
  cv.addEventListener('pointermove', function (ev) {
    if (!drag) { var h = hit(at(ev)); cv.style.cursor = h ? 'move' : 'default'; return; }
    var p = at(ev);
    if (drag.k === 'move') { drag.e.x = Math.max(-0.1, Math.min(1.1, p.x - drag.ox)); drag.e.y = Math.max(-0.1, Math.min(1.1, p.y - drag.oy)); }
    else { var l = local(drag.e, p); if (l) drag.e.w = Math.max(0.02, Math.min(2, drag.w0 * Math.hypot(l.x, l.y) / Math.max(1, drag.d0))); }
    draw();
  });
  cv.addEventListener('pointerup', function () { drag = null; save(true); });
  cv.addEventListener('wheel', function (ev) {
    var e = selEl(); if (!e) return; ev.preventDefault(); snapSoon();
    if (ev.shiftKey) e.rot = ((e.rot || 0) + (ev.deltaY > 0 ? 5 : -5)) % 360; else e.w = Math.max(0.02, Math.min(2, e.w * (ev.deltaY > 0 ? 0.94 : 1.06)));
    draw();
  }, { passive: false });
  var sT = 0; function snapSoon() { if (!sT) snap(); clearTimeout(sT); sT = setTimeout(function () { sT = 0; save(true); }, 600); }
  function act(k) {
    var e = selEl(); if (!e) return; snap(); var i = D.els.indexOf(e);
    if (k === 'small') e.w *= 0.88; else if (k === 'big') e.w *= 1.12; else if (k === 'rl') e.rot = (e.rot || 0) - 15; else if (k === 'rr') e.rot = (e.rot || 0) + 15; else if (k === 'flip') e.flip = !e.flip;
    else if (k === 'dup') { var n = JSON.parse(JSON.stringify(e)); n.id = FS.uid(); n.x = Math.min(0.95, n.x + 0.04); n.y = Math.min(0.95, n.y + 0.04); D.els.push(n); sel = n.id; }
    else if (k === 'up' && i < D.els.length - 1) { D.els.splice(i, 1); D.els.splice(i + 1, 0, e); } else if (k === 'down' && i > 0) { D.els.splice(i, 1); D.els.splice(i - 1, 0, e); }
    else if (k === 'del') { D.els.splice(i, 1); sel = null; }
    else if (k === 'layer') { e.under = !e.under; FS.toast(e.under ? '⇅ מאחורי התמונה: התמונה מכסה אותו בחלון' : '⇅ לפני התמונה: הוא מונח מעליה'); }
    draw(); save(true); tlist();
  }
  $('#fm-selbar', root).addEventListener('click', function (ev) { var b = ev.target.closest('[data-s]'); if (b) act(b.dataset.s); });
  $('#fm-scol', root).addEventListener('input', function () { var e = selEl(); if (!e || e.t === 'img') return; snapSoon(); e.color = this.value; draw(); });
  $('#fm-sop', root).addEventListener('input', function () { var e = selEl(); if (!e) return; snapSoon(); e.op = Number(this.value) / 100; draw(); });
  function add(e) { snap(); e.id = FS.uid(); if (e.x == null) { e.x = 0.5; e.y = 0.5; } e.rot = e.rot || 0; D.els.push(e); sel = e.id; draw(); save(true); }

  /* ---------- the side tabs ---------- */
  function tab(t) { $$('.fm-tabs [data-t]', root).forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); }); $$('.fm-side section', root).forEach(function (s) { s.hidden = s.dataset.p !== t; }); if (t === 'ex') buildExamples(); }
  $('.fm-tabs', root).addEventListener('click', function (ev) { var b = ev.target.closest('[data-t]'); if (b) tab(b.dataset.t); });
  function buildOrn() {
    var col = $('#fm-ecol', root).value;
    $('#fm-orn', root).innerHTML = (FS.ELEMENTS || []).map(function (e) { return '<button data-o="' + e[0] + '" title="' + esc(e[1]) + '"></button>'; }).join('');
    $$('#fm-orn [data-o]', root).forEach(function (b) { var c = FS.elementCanvas(b.dataset.o, col); if (c) { c.className = 'fm-oc'; b.appendChild(c); } b.insertAdjacentHTML('beforeend', '<span>' + esc((FS.ELEMENTS.filter(function (x) { return x[0] === b.dataset.o; })[0] || [])[1] || '') + '</span>'); });
    $('#fm-pal', root).innerHTML = [pal.paper, pal.accent, pal.ink, '#D9B677', '#FFFFFF', '#111111'].map(function (h) { return '<i data-c="' + h + '" style="background:' + h + '"></i>'; }).join('');
  }
  function buildPieces() {
    $('#fm-pieces', root).innerHTML = pieces.length ? pieces.map(function (p, i) { return '<button data-pc="' + i + '" title="' + esc(p.label) + '"><img src="' + p.src + '" alt=""><span>' + esc(p.label) + '</span></button>'; }).join('') : '<p class="fm-hint">' + (inv ? 'לוחצים "🤖 קריאת ההזמנה" בדוגמאות, או חותכים חלק בעצמכם.' : 'מעלים הזמנה בלשונית הדוגמאות.') + '</p>';
  }
  $('#fm-orn', root).addEventListener('click', function (ev) { var b = ev.target.closest('[data-o]'); if (!b) return; var e = FS.ELEMENTS.filter(function (x) { return x[0] === b.dataset.o; })[0]; add({ t: 'orn', key: b.dataset.o, color: $('#fm-ecol', root).value, w: e && e[2] === 'wide' ? 0.36 : 0.16 }); });
  $('#fm-ecol', root).addEventListener('change', buildOrn);
  $('#fm-pal', root).addEventListener('click', function (ev) { var i = ev.target.closest('[data-c]'); if (!i) return; $('#fm-ecol', root).value = i.dataset.c; buildOrn(); var e = selEl(); if (e && e.t !== 'img') { snap(); e.color = i.dataset.c; draw(); } });
  $('#fm-epal', root).addEventListener('click', function () { $('#fm-ecol', root).value = pal.accent; buildOrn(); });
  $('#fm-pieces', root).addEventListener('click', function (ev) { var b = ev.target.closest('[data-pc]'); if (b) add({ t: 'img', src: pieces[Number(b.dataset.pc)].src, w: 0.3 }); });
  $('#fm-img', root).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) FS.fileToDataURL(f).then(function (u) { return FS.loadImg(u).then(function () { add({ t: 'img', src: u, w: 0.28 }); }); }); });
  /* a piece of the invitation, marked by dragging a box over it */
  $('#fm-crop', root).addEventListener('click', function () {
    if (!inv) return FS.toast('מעלים קודם את ההזמנה (לשונית הדוגמאות)');
    var m = document.createElement('div'); m.className = 'fm-cropd'; m.innerHTML = '<div class="fm-cropc"><p>גוררים מלבן סביב הקישוט שרוצים (פרח, עלה, סמל). הרקע שלו יוסר.</p><div class="fm-cropw"><img src="' + invSrc + '" alt=""><i></i></div><div class="fm-row"><label class="fm-chk"><input type="checkbox" checked> הסרת הרקע</label><span class="fm-sp"></span><button class="fm-btn" data-c="x">ביטול</button><button class="fm-btn gold" data-c="ok">➕ הוספה</button></div></div>';
    root.appendChild(m); var w = $('.fm-cropw', m), box = $('i', m), r0 = null, rect = null;
    w.addEventListener('pointerdown', function (ev) { var b = w.getBoundingClientRect(); r0 = { x: (ev.clientX - b.left) / b.width, y: (ev.clientY - b.top) / b.height }; w.setPointerCapture(ev.pointerId); });
    w.addEventListener('pointermove', function (ev) { if (!r0) return; var b = w.getBoundingClientRect(), x = Math.max(0, Math.min(1, (ev.clientX - b.left) / b.width)), y = Math.max(0, Math.min(1, (ev.clientY - b.top) / b.height));
      rect = { x: Math.min(x, r0.x), y: Math.min(y, r0.y), w: Math.abs(x - r0.x), h: Math.abs(y - r0.y) }; box.style.cssText = 'left:' + rect.x * 100 + '%;top:' + rect.y * 100 + '%;width:' + rect.w * 100 + '%;height:' + rect.h * 100 + '%'; });
    w.addEventListener('pointerup', function () { r0 = null; });
    m.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-c]'); if (!b) return; if (b.dataset.c === 'x') return m.remove();
      if (!rect || rect.w < 0.02 || rect.h < 0.02) return FS.toast('גוררים מלבן על ההזמנה');
      var bx = [rect.y * 1000, rect.x * 1000, (rect.y + rect.h) * 1000, (rect.x + rect.w) * 1000], c;
      if ($('input', m).checked && FS.cutPiece) { c = FS.cutPiece(inv, bx); c = c && (c.canvas || c); }
      if (!c) { var iw = inv.naturalWidth, ih = inv.naturalHeight; c = FS.canvas(rect.w * iw, rect.h * ih); c.getContext('2d').drawImage(inv, rect.x * iw, rect.y * ih, rect.w * iw, rect.h * ih, 0, 0, c.width, c.height); }
      var u = c.toDataURL('image/png'); pieces.push({ label: 'חלק מההזמנה', src: u }); buildPieces(); m.remove(); FS.loadImg(u).then(function () { add({ t: 'img', src: u, w: 0.3 }); });
    });
  });
  /* texts */
  function hexOr(v, d) { return /^#[0-9a-f]{6}$/i.test(v || '') ? v : d; }
  function syncText() {
    var e = selEl(); tlist(); if (!e || e.t !== 'text') return;
    $('#fm-tt', root).value = e.text; $('#fm-tf', root).value = e.font; $('#fm-tc', root).value = hexOr(e.color, '#3a2e1f'); $('#fm-tb', root).checked = (e.weight || 700) >= 600; $('#fm-ti', root).checked = !!e.italic; $('#fm-ts', root).checked = !!e.shadow;
    $('#fm-to', root).checked = !!e.stroke; $('#fm-toc', root).value = hexOr(e.stroke, '#ffffff'); $('#fm-tow', root).value = Math.round((e.sw || 0.06) * 100); $('#fm-tls', root).value = Math.round((e.ls || 0) * 100);
  }
  function tStyle(e) {
    e.font = $('#fm-tf', root).value; e.color = $('#fm-tc', root).value; e.weight = $('#fm-tb', root).checked ? 700 : 400; e.italic = $('#fm-ti', root).checked; e.shadow = $('#fm-ts', root).checked;
    e.stroke = $('#fm-to', root).checked ? $('#fm-toc', root).value : ''; e.sw = Number($('#fm-tow', root).value) / 100; e.ls = Number($('#fm-tls', root).value) / 100; return e;
  }
  /* the text's box keeps its letters the same size when the words change */
  function textChange() {
    var e = selEl(); if (!e || e.t !== 'text') return; snapSoon();
    var old = elCanvas(e), ow = old ? old.width : 0; e.text = $('#fm-tt', root).value || ' '; tStyle(e);
    var nw = elCanvas(e); if (ow && nw && this && this.id === 'fm-tt') e.w = Math.max(0.03, Math.min(1.6, e.w * nw.width / ow));
    draw(); tlist();
  }
  ['#fm-tt', '#fm-tf', '#fm-tc', '#fm-tb', '#fm-ti', '#fm-ts', '#fm-to', '#fm-toc', '#fm-tow', '#fm-tls'].forEach(function (s) { $(s, root).addEventListener('input', textChange); $(s, root).addEventListener('change', textChange); });
  /* a new text goes to the band under the window (or above it), to a height no other text holds */
  function freeY() {
    var w = D.win, below = 1 - w.y - w.h, above = w.y, ys = D.els.filter(function (e) { return e.t === 'text'; }).map(function (e) { return e.y; });
    var start = below >= above ? w.y + w.h + Math.max(0.035, below * 0.45) : Math.max(0.04, above * 0.55), step = below >= above ? 0.065 : -0.065;
    for (var i = 0, y = start; i < 12; i++, y += step) { if (y > 0.97 || y < 0.03) break; if (!ys.some(function (v) { return Math.abs(v - y) < 0.05; })) return y; }
    return 0.5;
  }
  function addText(t) { if (!t) return FS.toast('כותבים טקסט'); add(tStyle({ t: 'text', text: t, w: Math.min(0.8, 0.07 + t.length * 0.035), y: freeY(), x: 0.5 })); syncText(); }
  $('#fm-tadd', root).addEventListener('click', function () { sel = null; addText($('#fm-tt', root).value.trim()); });
  $('.fm-quick', root).addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-q]'); if (!b) return; sel = null; var q = b.dataset.q, nm = $('#fm-names', root).value.trim();
    addText(q === 'names' ? nm || 'נועה ודניאל' : q === 'date' ? $('#fm-date', root).value.trim() || '12.12.2026' : q === 'thanks' ? 'תודה שבאתם לשמוח איתנו' : q === 'mazal' ? 'מזל טוב!' : '#' + (nm.replace(/\s+/g, '_') || 'האירוע_שלנו'));
  });
  /* every text on the frame, to change in place, pick or delete */
  function tlist() {
    var box = $('#fm-tlist', root); if (!box || !D) return; var l = D.els.filter(function (e) { return e.t === 'text'; });
    if (box.contains(document.activeElement) && box.children.length === l.length) return;
    box.innerHTML = l.length ? l.map(function (e) { return '<div class="fm-tr' + (e.id === sel ? ' on' : '') + '" data-tid="' + e.id + '"><input value="' + esc(e.text) + '"><button class="fm-btn" data-tx="pick" title="סימון">🎯</button><button class="fm-btn" data-tx="del" title="מחיקה">✕</button></div>'; }).join('') : '<p class="fm-hint">אין עדיין טקסט במסגרת.</p>';
  }
  $('#fm-tlist', root).addEventListener('input', function (ev) {
    var r = ev.target.closest('[data-tid]'), e = r && D.els.filter(function (x) { return x.id === r.dataset.tid; })[0]; if (!e) return; snapSoon();
    var old = elCanvas(e), ow = old ? old.width : 0; e.text = ev.target.value || ' '; var nw = elCanvas(e); if (ow && nw) e.w = Math.max(0.03, Math.min(1.6, e.w * nw.width / ow));
    if (e.id === sel) $('#fm-tt', root).value = e.text; draw();
  });
  $('#fm-tlist', root).addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-tx]'), r = b && b.closest('[data-tid]'); if (!r) return; sel = r.dataset.tid;
    if (b.dataset.tx === 'del') act('del'); else { syncText(); draw(); }
  });
  cv.addEventListener('dblclick', function (ev) { var h = hit(at(ev)); if (h && h.t === 'text') { sel = h.id; tab('txt'); syncText(); draw(); var t = $('#fm-tt', root); t.focus(); t.select(); } });
  /* background and window */
  function bgUI() {
    $('#fm-bgc', root).value = /^#[0-9a-f]{6}$/i.test(D.bg.color || '') ? D.bg.color : '#ffffff'; $('#fm-dim', root).value = Math.round((D.bg.dim || 0) * 100);
    $$('#fm-shape [data-s]', root).forEach(function (b) { b.classList.toggle('on', b.dataset.s === D.shape); });
    var w = D.win; $('#fm-wx', root).value = Math.round(w.x * 100); $('#fm-wy', root).value = Math.round(w.y * 100); $('#fm-wb', root).value = Math.round((1 - w.y - w.h) * 100); $('#fm-wr', root).value = Math.round(D.radius * 100);
    $('#fm-lc', root).value = /^#[0-9a-f]{6}$/i.test(D.line.color || '') ? D.line.color : '#b8904f'; $('#fm-lw', root).value = Math.round(D.line.w * 1000 / 2); $('#fm-ld', root).checked = !!D.line.double;
    var gen = D.bg.gen && D.bg.gen.fn !== 'cover'; ['#fm-wx', '#fm-wy', '#fm-wb'].forEach(function (s) { $(s, root).disabled = gen; });
  }
  function bgChange(fn) { return function () { snapSoon(); fn.call(this); cache = {}; draw(); }; }
  $('#fm-bgc', root).addEventListener('input', bgChange(function () { D.bg.color = this.value; }));
  $('#fm-dim', root).addEventListener('input', bgChange(function () { D.bg.dim = Number(this.value) / 100; }));
  $('#fm-bgi', root).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) FS.fileToDataURL(f).then(function (u) { snap(); D.bg.src = u; D.bg.gen = null; cache = {}; draw(); }); });
  $('#fm-bginv', root).addEventListener('click', function () { if (!inv) return FS.toast('מעלים קודם את ההזמנה'); snap(); D.bg.gen = { fn: 'cover' }; D.bg.src = ''; cache = {}; bgUI(); draw(); });
  $('#fm-bgx', root).addEventListener('click', function () { snap(); D.bg.gen = null; D.bg.src = ''; cache = {}; bgUI(); draw(); });
  $('#fm-shape', root).addEventListener('click', function (ev) { var b = ev.target.closest('[data-s]'); if (!b) return; snap(); D.shape = b.dataset.s; if (D.bg.gen && D.bg.gen.fn === 'magnet') D.bg.gen.shape = D.shape; cache = {}; bgUI(); draw(); });
  function winSet() { var x = Number($('#fm-wx', root).value) / 100, y = Number($('#fm-wy', root).value) / 100, b = Number($('#fm-wb', root).value) / 100; D.win = { x: x, y: y, w: Math.max(0.1, 1 - 2 * x), h: Math.max(0.1, 1 - y - b) }; }
  ['#fm-wx', '#fm-wy', '#fm-wb'].forEach(function (s) { $(s, root).addEventListener('input', bgChange(winSet)); });
  $('#fm-wr', root).addEventListener('input', bgChange(function () { D.radius = Number(this.value) / 100; }));
  $('#fm-lc', root).addEventListener('input', bgChange(function () { D.line.color = this.value; }));
  $('#fm-lw', root).addEventListener('input', bgChange(function () { D.line.w = Number(this.value) * 2 / 1000; }));
  $('#fm-ld', root).addEventListener('change', bgChange(function () { D.line.double = this.checked; }));

  /* ---------- saving: this browser, "המסגרות שלי", and the chosen folder ---------- */
  function idb() { return new Promise(function (ok, no) { var r = indexedDB.open('fs-frame-maker', 1); r.onupgradeneeded = function () { r.result.createObjectStore('d', { keyPath: 'id' }); r.result.createObjectStore('h'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = no; }); }
  function tx(store, mode, fn) { return idb().then(function (db) { return new Promise(function (ok, no) { var t = db.transaction(store, mode), s = t.objectStore(store), r = fn(s); t.oncomplete = function () { ok(r && r.result); }; t.onerror = function () { no(t.error); }; }); }); }
  function save(quiet) { if (!D) return; D.at = Date.now(); D.inv = invSrc || D.inv || ''; var copy = JSON.parse(JSON.stringify(D)); tx('d', 'readwrite', function (s) { return s.put(copy); }).catch(function () {}); if (!quiet) buildMine(); }
  function buildMine() {
    tx('d', 'readonly', function (s) { return s.getAll(); }).then(function (l) {
      l = (l || []).sort(function (a, b) { return b.at - a.at; });
      if (l.length > 30) l.slice(30).forEach(function (d) { tx('d', 'readwrite', function (s) { return s.delete(d.id); }); });
      $('#fm-mine', root).innerHTML = l.slice(0, 30).map(function (d) { return '<div class="fm-m"><button class="fm-btn" data-m="' + esc(d.id) + '">✏️ ' + esc(d.name || 'מסגרת') + '</button><button class="fm-btn" data-mx="' + esc(d.id) + '" title="מחיקה">✕</button></div>'; }).join('') || '<p class="fm-hint">עוד אין.</p>';
    }).catch(function () {});
  }
  $('#fm-mine', root).addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-m]'), x = ev.target.closest('[data-mx]');
    if (x) { if (confirm('למחוק את העיצוב?')) tx('d', 'readwrite', function (s) { return s.delete(x.dataset.mx); }).then(buildMine); return; }
    if (b) tx('d', 'readonly', function (s) { return s.get(b.dataset.m); }).then(load);
  });
  function load(d) {
    if (!d) return; D = Object.assign(blank(), d); sel = null; hist = []; fut = []; cache = {};
    var go = D.inv ? FS.loadImg(D.inv).then(function (im) { inv = im; invSrc = D.inv; $('#fm-inv-img', root).src = invSrc; root.classList.add('has-inv'); }, function () {}) : Promise.resolve();
    go.then(function () { ui(); draw(); tab('els'); });
  }
  function pngOf() { var s = sizeOf(D.size); sel = null; return render(s.W, s.H, false); }
  function fname() { return String(D.name || 'מסגרת').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'מסגרת'; }
  /* the folder chosen once is remembered (its handle in IndexedDB, read when the editor opens); the picker and the
     permission prompt are asked right on the click, before any other work, since the browser allows them only then */
  var dirH = null;
  function pickDir() {
    if (!window.showDirectoryPicker) return Promise.resolve(null);
    return window.showDirectoryPicker({ id: 'optimus-frames', mode: 'readwrite' }).then(function (d) { dirH = d; dirName(d); tx('h', 'readwrite', function (s) { return s.put(d, 'dir'); }).catch(function () {}); return d; }, function () { return null; });
  }
  function dirHandle() {
    if (!window.showDirectoryPicker) return Promise.resolve(null);
    if (!dirH) return pickDir();
    var h = dirH;
    return (h.queryPermission ? h.queryPermission({ mode: 'readwrite' }) : Promise.resolve('granted')).then(function (p) { return p === 'granted' ? h : h.requestPermission({ mode: 'readwrite' }).then(function (p2) { return p2 === 'granted' ? h : null; }); }).catch(function () { return null; });
  }
  function dirName(h) { $('#fm-dirn', root).textContent = h ? h.name : 'בחירת תיקייה'; }
  function writeFile(dir, name, blob) { return dir.getFileHandle(name, { create: true }).then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(blob).then(function () { return w.close(); }); }); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); }
  function saveAll() {
    if (!D) return; D.name = $('#fm-name', root).value.trim() || D.name;
    var api = !!window.showDirectoryPicker;
    dirHandle().then(function (dir) {
      save(); FS.busy('💾 שומר את המסגרת…');
      var c = pngOf(), name = fname(), url = c.toDataURL('image/png'), json = new Blob([JSON.stringify(D)], { type: 'application/json' });
      var toMine = FS.addUserFrame ? FS.addUserFrame(url, name).then(function () { if (FS.emit) FS.emit('frames'); if (FS.buildFrames) FS.buildFrames(); }) : Promise.resolve();
      var toDir = new Promise(function (ok) { c.toBlob(ok, 'image/png'); }).then(function (png) {
        if (dir) return writeFile(dir, name + '.png', png).then(function () { return writeFile(dir, name + '.optimus-frame.json', json); }).then(function () { return ' ובתיקייה "' + dir.name + '"'; });
        if (!api) { download(name + '.png', png); download(name + '.optimus-frame.json', json); return ' ובתיקיית ההורדות'; }
        return ' (בלי תיקייה: לא נבחרה)';
      });
      return Promise.all([toMine, toDir]).then(function (r) { FS.busy(); draw(); FS.toast('✔ "' + name + '" נשמרה ב"המסגרות שלי"' + r[1], 6000); });
    }).catch(function (e) { FS.busy(); draw(); FS.toast('השמירה לא הצליחה: ' + (e && e.message || ''), 7000); });
  }
  $('#fm-save', root).addEventListener('click', saveAll);
  $('#fm-dir', root).addEventListener('click', function () { if (!window.showDirectoryPicker) return FS.toast('בדפדפן הזה המסגרות יורדות לתיקיית ההורדות. בתוכנה למחשב אפשר לבחור תיקייה.'); pickDir().then(function (d) { if (d) FS.toast('📁 המסגרות יישמרו ב"' + d.name + '"'); }); });
  $('#fm-open', root).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (!f) return; f.text().then(function (t) { var d = JSON.parse(t); if (!d || !d.win || !Array.isArray(d.els)) throw new Error('bad'); load(d); FS.toast('📂 נפתחה "' + (d.name || 'מסגרת') + '"'); }).catch(function () { FS.toast('זה לא קובץ עיצוב של אופטימוס (.optimus-frame.json)'); }); });

  /* ---------- the rest ---------- */
  function ui() { $('#fm-name', root).value = D.name || ''; $('#fm-size', root).value = D.size; bgUI(); buildOrn(); buildPieces(); syncText(); }
  $('#fm-name', root).addEventListener('change', function () { D.name = this.value.trim() || D.name; save(true); });
  $('#fm-size', root).addEventListener('change', function () { snap(); D.size = this.value; cache = {}; draw(); buildExamples(); });
  $('#fm-inv', root).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) loadInvite(f); });
  $('#fm-read', root).addEventListener('click', function () { if (!inv) return FS.toast('מעלים קודם את ההזמנה'); readInvite(); });
  $('#fm-reex', root).addEventListener('click', buildExamples);
  $('#fm-ai10', root).addEventListener('click', ai10);
  $('#fm-aior', root).addEventListener('click', function (ev) { var b = ev.target.closest('[data-o]'); if (!b) return; aiOr = b.dataset.o; $$('#fm-aior [data-o]', root).forEach(function (x) { x.classList.toggle('on', x === b); }); });
  $('#fm-aiex', root).addEventListener('click', function (ev) { var b = ev.target.closest('[data-aj]'); if (!b) return; var j = aiEx[Number(b.dataset.aj)]; if (!j) return; if (j.st === 'ok') useAI(j); else if (j.st === 'err' && inv) aiJob(j); });
  $('#fm-ph', root).addEventListener('change', function () { showPhoto = this.checked; draw(); });
  $('#fm-undo', root).addEventListener('click', undo); $('#fm-redo', root).addEventListener('click', redo);
  $('#fm-close', root).addEventListener('click', close);
  root.addEventListener('dragover', function (ev) { ev.preventDefault(); });
  root.addEventListener('drop', function (ev) { ev.preventDefault(); var f = ev.dataTransfer.files && ev.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) loadInvite(f); });
  window.addEventListener('keydown', function (ev) {
    if (root.hidden) return; var typing = /input|textarea|select/i.test(ev.target.tagName || ''), k = (ev.key || '').toLowerCase(), mod = ev.ctrlKey || ev.metaKey;
    if (k === 'escape') { ev.preventDefault(); if ($('.fm-cropd', root)) $('.fm-cropd', root).remove(); else if (sel) { sel = null; draw(); } else close(); }
    else if (typing) return;
    else if (mod && k === 'z') { ev.preventDefault(); undo(); } else if (mod && k === 'y') { ev.preventDefault(); redo(); } else if (mod && k === 'd') { ev.preventDefault(); act('dup'); } else if (mod && k === 's') { ev.preventDefault(); saveAll(); }
    else if ((k === 'delete' || k === 'backspace') && sel) { ev.preventDefault(); act('del'); }
    else if (/^arrow/.test(k) && sel) { ev.preventDefault(); var e = selEl(), st = ev.shiftKey ? 0.02 : 0.004; snapSoon(); if (k === 'arrowleft') e.x -= st; if (k === 'arrowright') e.x += st; if (k === 'arrowup') e.y -= st; if (k === 'arrowdown') e.y += st; draw(); }
    else return;
    ev.stopImmediatePropagation();
  }, true);
  window.addEventListener('resize', function () { if (!root.hidden) draw(); });
  function sample() {
    var S = FS.state, p = S && S.photos && (S.photos[S.cur] || S.photos[0]), src = p ? (p.src) : 'media/real/wedding-1.webp';
    return FS.loadImg(src).then(function (im) { photo = im; }, function () { photo = null; });
  }
  function open() {
    if (!D) D = blank();
    root.hidden = false; document.body.classList.add('fm-on');
    sample().then(function () { ui(); draw(); buildExamples(); buildMine(); });
    if (!dirH) tx('h', 'readonly', function (s) { return s.get('dir'); }).then(function (h) { dirH = h || null; dirName(h); }).catch(function () {});
  }
  function close() { save(true); root.hidden = true; document.body.classList.remove('fm-on'); }
  /* any button with data-fm-open opens it (the studio's frames tab, the workspace's frames panel) */
  document.addEventListener('click', function (ev) { if (ev.target.closest && ev.target.closest('[data-fm-open]')) { ev.preventDefault(); open(); } });
  FS.frameMaker = { open: open, close: close, render: function () { return D && pngOf(); }, design: function () { return D; } };
})();
