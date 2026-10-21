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
  var PZ = { s: 1, dx: 0, dy: 0 };   /* the preview photo's zoom and offset inside the window (share of the window) */

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
      if (PZ.s !== 1 || PZ.dx || PZ.dy) { d.photo.s *= PZ.s; d.photo.x += PZ.dx * H.w; d.photo.y += PZ.dy * H.h; }
      if (D.line) {
        var top = H.y > m * 0.1, size = Math.round(m * (top ? 0.042 : 0.04));
        d.layers.push({ id: 'line', type: 'text', text: D.line, x: d.w / 2, y: top ? H.y / 2 + size * 0.35 : H.y + m * 0.07, size: size, font: D.font, weight: 700, color: top ? (D.ink || FS.inkFor(D.color)) : '#ffffff', shadow: !top, strokeW: 0, stroke: '#000', r: 0, opacity: 1, align: 'center' });
      }
      /* texts moved or resized on the preview keep their place (by their stable key) */
      var lay = D.lay || {};
      d.layers.forEach(function (L) { var o = L.type === 'text' && lay[tkey(L)]; if (o) { L.x += o.dx * d.w; L.y += o.dy * d.h; L.size *= o.k; } });
      D.deco.forEach(function (o) {
        var im = FS.img(o.src); if (!im) return;
        d.layers.push({ id: o.id, deco: true, type: 'image', src: o.src, s: o.w * d.w / im.naturalWidth, x: o.x * d.w, y: o.y * d.h, r: o.r || 0, opacity: o.opacity == null ? 1 : o.opacity, flip: !!o.flip });
      });
      return p;
    });
  }
  /* the frame built from the invitation lives with the design (a light WebP), and is registered as a PNG frame on use */
  function ensureInvFrame() {
    var f = D && D.invFrame; if (!f || PNGS.some(function (x) { return x.key === f.key; })) return Promise.resolve();
    return FS.addUserFrame(f.src, f.name || 'מסגרת מההזמנה', false).then(function (u) { PNGS.push({ id: u.id, key: f.key, name: f.name || 'מסגרת מההזמנה', for: [] }); }).catch(function () {});
  }
  function render() {
    if (drawing) { again = true; return drawing; }
    drawing = ensureInvFrame().then(function () { return Promise.all(D.deco.map(function (o) { return FS.loadImg(o.src).catch(function () {}); })); }).then(build).then(function (p) {
      P = p; var cv = $('#cv'), wrap = $('#wrap'), d = p.doc, box = wrap.getBoundingClientRect();
      var k = Math.min((box.width || 500) / d.w, (Math.min(window.innerHeight * 0.72, 720)) / d.h), dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(d.w * k * dpr); cv.height = Math.round(d.h * k * dpr); cv.style.width = Math.round(d.w * k) + 'px'; cv.style.height = Math.round(d.h * k) + 'px';
      FS.draw(cv.getContext('2d'), p, { scale: k * dpr, max: 1400, export: true, noPhoto: view === 'frame', transparent: view === 'frame' });
      cv.classList.toggle('see-through', view === 'frame');
      overlay(cv.getContext('2d'), d, k * dpr);
    }).catch(function (e) { if (window.console) console.warn(e); }).then(function () { drawing = null; if (again) { again = false; render(); } });
    return drawing;
  }
  function decoBox(o, d) { var im = FS.img(o.src); if (!im) return null; var w = o.w * d.w, h = w * im.naturalHeight / im.naturalWidth; return { x: o.x * d.w - w / 2, y: o.y * d.h - h / 2, w: w, h: h }; }
  function tkey(L) { return L.link || (L.id === 'line' ? 'line' : ''); }
  function changed() { render(); clearTimeout(saveT); saveT = setTimeout(function () { if (D.saved) save(true); }, 1200); }

  /* ---------- editing everything on the preview: the window, the photo in it, the texts and the ornaments ----------
     Corners of the window resize it and its edge moves it; inside it the photo moves (the wheel zooms it). A text or an
     ornament is dragged to move it, and its round handle resizes it. */
  var tsel = '', wlive = null, HANDLE = 0.028, guides = false;
  function imActive() { return !!(IM && IM.key && D.invFrame && D.invFrame.key === IM.key && view !== 'frame'); }
  function winBox(d) { if (wlive) return { x: wlive.x * d.w, y: wlive.y * d.h, w: wlive.w * d.w, h: wlive.h * d.h }; return FS.hole(d); }
  function textBox(L, d) {
    var c = textBox.c || (textBox.c = FS.canvas(4, 4).getContext('2d'));
    c.font = (L.weight || 700) + ' ' + L.size + 'px "' + L.font + '"'; var w = c.measureText(L.text || '').width;
    var x = L.align === 'right' ? L.x - w : L.align === 'left' ? L.x : L.x - w / 2;
    return { x: x - L.size * 0.15, y: L.y - L.size * 0.62, w: w + L.size * 0.3, h: L.size * 1.24 };
  }
  function texts(d) { return d.layers.filter(function (L) { return L.type === 'text' && tkey(L) && L.text; }); }
  function handleAt(b) { return { x: b.x, y: b.y + b.h }; }   /* the bottom-left corner: the far end for a right-to-left page */
  function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#c9a45c'; ctx.fill(); ctx.lineWidth = r * 0.35; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  function overlay(ctx, d, k) {
    var m = Math.min(d.w, d.h), r = m * 0.016 * k; ctx.save();
    if (imActive()) {
      var w = winBox(d); ctx.setLineDash([7, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = wlive ? '#c9a45c' : 'rgba(201,164,92,.75)'; ctx.strokeRect(w.x * k, w.y * k, w.w * k, w.h * k); ctx.setLineDash([]);
      [[w.x, w.y], [w.x + w.w, w.y], [w.x, w.y + w.h], [w.x + w.w, w.y + w.h]].forEach(function (c) { dot(ctx, c[0] * k, c[1] * k, r); });
    }
    var b = null;
    if (sel) { var o = D.deco.filter(function (x) { return x.id === sel; })[0]; if (o) b = decoBox(o, d); }
    else if (tsel) { var L = texts(d).filter(function (x) { return tkey(x) === tsel; })[0]; if (L) b = textBox(L, d); }
    if (b) { ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeStyle = '#c9a45c'; ctx.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k); ctx.setLineDash([]); var h = handleAt(b); dot(ctx, h.x * k, h.y * k, r * 1.1); }
    if (guides) {
      /* the print check: the cut line (the magnet's edge) and the safe area 3mm inside it, where nothing important may be */
      var s = safe(d), W = d.w * k, H = d.h * k;
      ctx.fillStyle = 'rgba(220,40,60,.13)'; ctx.fillRect(0, 0, W, s * k); ctx.fillRect(0, H - s * k, W, s * k); ctx.fillRect(0, s * k, s * k, H - 2 * s * k); ctx.fillRect(W - s * k, s * k, s * k, H - 2 * s * k);
      ctx.lineWidth = Math.max(1, k * 2); ctx.setLineDash([8, 5]); ctx.strokeStyle = '#d7263d'; ctx.strokeRect(1, 1, W - 2, H - 2);
      ctx.strokeStyle = '#1f9d6b'; ctx.strokeRect(s * k, s * k, W - 2 * s * k, H - 2 * s * k); ctx.setLineDash([]);
      ctx.font = '600 ' + Math.max(11, Math.round(m * 0.03 * k)) + 'px Heebo, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#1f9d6b'; ctx.fillText('אזור בטוח', W / 2, s * k + Math.max(13, m * 0.035 * k));
    }
    ctx.restore();
    printCheck(d);
  }
  /* 3mm inside the edge: the cut can move that much */
  function safe(d) { var mm = FS.mmOf ? FS.mmOf(d) : [d.w / 300 * 25.4, d.h / 300 * 25.4]; return 3 * d.w / mm[0]; }
  function printCheck(d) {
    var s = safe(d), bad = [], el = $('#warn'); if (!el) return;
    texts(d).forEach(function (L) { if (L.credit) return; var b = textBox(L, d); if (b.x < s || b.y < s || b.x + b.w > d.w - s || b.y + b.h > d.h - s) bad.push('"' + L.text + '"'); });
    D.deco.forEach(function (o) { var b = decoBox(o, d); if (b && !o.auto && (b.x + b.w * 0.5 < 0 || b.y + b.h * 0.5 < 0 || b.x + b.w * 0.5 > d.w || b.y + b.h * 0.5 > d.h)) bad.push('עיטור "' + (o.label || '') + '" יוצא מהמגנט'); });
    el.hidden = !bad.length;
    if (bad.length) el.innerHTML = '⚠️ קרוב מדי לקצה ועלול להיחתך בהדפסה: ' + esc(bad.slice(0, 3).join(', ')) + '. גוררים פנימה, או לוחצים "📏 בדיקת הדפסה" כדי לראות את הקווים.';
  }
  (function () {
    var cv = $('#cv'), drag = null;
    function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; }
    function near(q, x, y, d) { var m = Math.min(d.w, d.h) * HANDLE * 1.6; return Math.abs(q.x * d.w - x) < m && Math.abs(q.y * d.h - y) < m; }
    function inside(q, b, d, pad) { var X = q.x * d.w, Y = q.y * d.h; pad = pad || 0; return X >= b.x - pad && X <= b.x + b.w + pad && Y >= b.y - pad && Y <= b.y + b.h + pad; }
    function pick() { decos(); render(); }
    cv.addEventListener('pointerdown', function (e) {
      if (!P) return; var q = pt(e), d = P.doc, m = Math.min(d.w, d.h), go = function (g) { drag = g; cv.setPointerCapture(e.pointerId); e.preventDefault(); };
      /* 1. the handle of what is selected */
      var so = sel && D.deco.filter(function (x) { return x.id === sel; })[0], sb = so ? decoBox(so, d) : null;
      if (sb && near(q, handleAt(sb).x, handleAt(sb).y, d)) return go({ k: 'deco-size', o: so, cx: so.x * d.w, w0: so.w, r0: Math.hypot(q.x * d.w - so.x * d.w, q.y * d.h - so.y * d.h) });
      var tl = tsel && texts(d).filter(function (x) { return tkey(x) === tsel; })[0], tb = tl ? textBox(tl, d) : null;
      if (tb && near(q, handleAt(tb).x, handleAt(tb).y, d)) { var lo = (D.lay = D.lay || {})[tsel] || (D.lay[tsel] = { dx: 0, dy: 0, k: 1 }); return go({ k: 'text-size', o: lo, k0: lo.k, cx: tl.x, cy: tl.y, r0: Math.hypot(q.x * d.w - tl.x, q.y * d.h - tl.y) }); }
      /* 2. the window's corners and edge */
      var W = imActive() ? FS.hole(d) : null;
      if (W) {
        var cs = [[W.x, W.y], [W.x + W.w, W.y], [W.x, W.y + W.h], [W.x + W.w, W.y + W.h]];
        for (var i = 0; i < 4; i++) if (near(q, cs[i][0], cs[i][1], d)) { sel = null; tsel = ''; wlive = { x: W.x / d.w, y: W.y / d.h, w: W.w / d.w, h: W.h / d.h }; return go({ k: 'win-size', c: i, ax: cs[3 - i][0] / d.w, ay: cs[3 - i][1] / d.h }); }
      }
      /* 3. an ornament, then a text */
      var hit = null;
      D.deco.slice().reverse().some(function (o) { var b = decoBox(o, d); if (b && inside(q, b, d)) { hit = o; return true; } return false; });
      if (hit) { sel = hit.id; tsel = ''; pick(); return go({ k: 'deco', o: hit, dx: q.x - hit.x, dy: q.y - hit.y }); }
      var th = texts(d).slice().reverse().filter(function (L) { return inside(q, textBox(L, d), d); })[0];
      if (th) { tsel = tkey(th); sel = null; var lo2 = (D.lay = D.lay || {})[tsel] || (D.lay[tsel] = { dx: 0, dy: 0, k: 1 }); pick(); return go({ k: 'text', o: lo2, x: q.x, y: q.y, dx0: lo2.dx, dy0: lo2.dy }); }
      if (sel || tsel) { sel = null; tsel = ''; pick(); }
      /* 4. the window's edge moves it; inside it the photo moves */
      if (W) {
        var band = m * 0.03, inW = inside(q, W, d, band), deep = inside(q, { x: W.x + band, y: W.y + band, w: W.w - 2 * band, h: W.h - 2 * band }, d);
        if (inW && !deep) { wlive = { x: W.x / d.w, y: W.y / d.h, w: W.w / d.w, h: W.h / d.h }; return go({ k: 'win', gx: q.x - wlive.x, gy: q.y - wlive.y }); }
      }
      if (view === 'photo') { var H = FS.hole(d); go({ k: 'photo', x: q.x * d.w, y: q.y * d.h, dx: PZ.dx, dy: PZ.dy, hw: H.w, hh: H.h }); }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) { if (P) cv.style.cursor = cursorAt(pt(e)); return; }
      var q = pt(e), d = P.doc, g = drag;
      if (g.k === 'photo') { PZ.dx = g.dx + (q.x * d.w - g.x) / g.hw; PZ.dy = g.dy + (q.y * d.h - g.y) / g.hh; }
      else if (g.k === 'deco') { g.o.x = Math.max(0, Math.min(1, q.x - g.dx)); g.o.y = Math.max(0, Math.min(1, q.y - g.dy)); }
      else if (g.k === 'deco-size') { g.o.w = Math.max(0.04, Math.min(1.2, g.w0 * Math.hypot(q.x * d.w - g.o.x * d.w, q.y * d.h - g.o.y * d.h) / Math.max(1, g.r0))); }
      else if (g.k === 'text') { g.o.dx = g.dx0 + q.x - g.x; g.o.dy = g.dy0 + q.y - g.y; }
      else if (g.k === 'text-size') { g.o.k = Math.max(0.3, Math.min(4, g.k0 * Math.hypot(q.x * d.w - g.cx, q.y * d.h - g.cy) / Math.max(1, g.r0))); }
      else if (g.k === 'win') { wlive.x = Math.max(0, Math.min(1 - wlive.w, q.x - g.gx)); wlive.y = Math.max(0, Math.min(1 - wlive.h, q.y - g.gy)); }
      else if (g.k === 'win-size') { var x = Math.max(0, Math.min(1, q.x)), y = Math.max(0, Math.min(1, q.y)); wlive = { x: Math.min(x, g.ax), y: Math.min(y, g.ay), w: Math.max(0.08, Math.abs(x - g.ax)), h: Math.max(0.08, Math.abs(y - g.ay)) }; }
      render();
    });
    function end() {
      var g = drag; drag = null; if (!g) return;
      if (g.k === 'win' || g.k === 'win-size') { var w = wlive; wlive = null; imFromPage(w); return; }
      if (g.k !== 'photo') changed();
    }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    function cursorAt(q) {
      var d = P.doc, W = imActive() ? FS.hole(d) : null;
      if (W) { var cs = [[W.x, W.y], [W.x + W.w, W.y], [W.x, W.y + W.h], [W.x + W.w, W.y + W.h]]; for (var i = 0; i < 4; i++) if (near(q, cs[i][0], cs[i][1], d)) return i === 0 || i === 3 ? 'nwse-resize' : 'nesw-resize'; }
      if (D.deco.some(function (o) { var b = decoBox(o, d); return b && inside(q, b, d); }) || texts(d).some(function (L) { return inside(q, textBox(L, d), d); })) return 'move';
      if (W) { var band = Math.min(d.w, d.h) * 0.03; if (inside(q, W, d, band) && !inside(q, { x: W.x + band, y: W.y + band, w: W.w - 2 * band, h: W.h - 2 * band }, d)) return 'move'; }
      return view === 'photo' ? 'grab' : 'default';
    }
    cv.addEventListener('wheel', function (e) {
      if (view !== 'photo') return; e.preventDefault(); var f = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      if (tsel && D.lay && D.lay[tsel]) { D.lay[tsel].k = Math.max(0.3, Math.min(4, D.lay[tsel].k * f)); render(); clearTimeout(cv._wt); cv._wt = setTimeout(changed, 400); return; }
      PZ.s = Math.max(0.5, Math.min(3, PZ.s * f)); pzOut(); render();
    }, { passive: false });
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
    var base = FS.GEN_FRAMES.filter(function (f) { return f.base; }).map(function (f) { return f.id; });
    var gen = base.concat(ev.frames.filter(function (id) { return base.indexOf(id) < 0; }), FS.GEN_FRAMES.map(function (f) { return f.id; }).filter(function (id) { return ev.frames.indexOf(id) < 0 && base.indexOf(id) < 0; })).filter(function (id) { return hide.indexOf(id) < 0; });
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
    setTimeout(apStatus, 0);
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
    var V = new URL('vendor/pdfjs/', location.href).href;   /* shipped with the site: works offline */
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
    IM = null; FS.invWindow = null; imCreate('smart');
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
  var imShow = function () {};
  /* a hand-drawn box on the invitation; once the invitation is a magnet, the box is its window: drag it to move it,
     pull its corner to make it bigger or smaller, and the magnet follows */
  (function () {
    var boxEl = $('#inv-box'), mark = $('#inv-sel'), start = null, rect = null, mode = null, grab = null;
    mark.appendChild(document.createElement('b'));
    function pt(e) { var r = $('#inv-img').getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; }
    boxEl.addEventListener('pointerdown', function (e) {
      if (!invImg) return; var q = pt(e); boxEl.setPointerCapture(e.pointerId); e.preventDefault();
      if (IM && e.target.tagName === 'B') { mode = 'size'; return; }
      if (IM && e.target === mark) { mode = 'move'; grab = { x: q.x - IM.rect.x, y: q.y - IM.rect.y }; return; }
      mode = 'draw'; start = q; rect = null;
    });
    boxEl.addEventListener('pointermove', function (e) {
      if (!mode) return; var q = pt(e);
      if (mode === 'move') { var w = IM.rect; w.x = Math.max(0, Math.min(1 - w.w, q.x - grab.x)); w.y = Math.max(0, Math.min(1 - w.h, q.y - grab.y)); imShow(); imSoon(); return; }
      /* the corner on the left-bottom grows the window from its top-right corner (the page reads right to left) */
      if (mode === 'size') { var v = IM.rect, rx = v.x + v.w; v.w = Math.max(0.08, Math.min(rx, rx - q.x)); v.x = rx - v.w; v.h = Math.max(0.08, Math.min(1 - v.y, q.y - v.y)); imShow(); imSoon(); return; }
      rect = { x: Math.min(start.x, q.x), y: Math.min(start.y, q.y), w: Math.abs(q.x - start.x), h: Math.abs(q.y - start.y) };
      mark.hidden = false; mark.classList.remove('live'); place(rect);
    });
    function place(r) { mark.style.left = r.x * 100 + '%'; mark.style.top = r.y * 100 + '%'; mark.style.width = r.w * 100 + '%'; mark.style.height = r.h * 100 + '%'; }
    imShow = function () {
      if (!IM) return; var r = IM.rect; mark.hidden = false; mark.classList.add('live'); place(r);
      $('#im-adj').hidden = false; $('#pz-adj').hidden = false;
      $('#im-w').value = Math.round(r.w * 100); $('#im-h').value = Math.round(r.h * 100); $('#im-x').value = Math.round((r.x + r.w / 2) * 100); $('#im-y').value = Math.round((r.y + r.h / 2) * 100);
      ['w', 'h', 'x', 'y'].forEach(function (k) { $('#im-' + k + '-o').textContent = $('#im-' + k).value + '%'; });
    };
    boxEl.addEventListener('pointerup', function () {
      var m = mode; mode = null; start = null; if (m === 'move' || m === 'size') { imSoon(0); return; }
      if (m !== 'draw') return;
      var ok = !!(rect && rect.w > 0.02 && rect.h > 0.02); $('#inv-cut').disabled = !ok;
      if (ok) { FS.invWindow = Object.assign({}, rect); var st = $('#im-state'); if (st) st.textContent = IM ? '✓ החלון הוזז למקום שסימנתם.' : '✓ סימנתם את מקום התמונה. עכשיו בוחרים צורה ולוחצים.'; if (IM && rect.w > 0.06 && rect.h > 0.06) { IM.rect = Object.assign({}, rect); imShow(); imSoon(0); } }
      else if (IM) imShow();
    });
    $('#inv-cut').addEventListener('click', function () {
      if (!rect) return; var c = FS.cutPiece(invImg, [rect.y * 1000, rect.x * 1000, (rect.y + rect.h) * 1000, (rect.x + rect.w) * 1000]);
      PIECES.unshift({ label: 'גזירה שלי', c: c }); drawPieces(); mark.hidden = true; rect = null; this.disabled = true; if (IM) imShow();
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

  /* ---------- a whole frame from the invitation (portrait, landscape or square), built in the browser ---------- */
  ['b', 't'].forEach(function (k) { $('#if-' + k).addEventListener('input', function () { $('#if-' + k + '-o').textContent = this.value + '%'; }); });
  function invFrame(fmt) {
    if (!invImg) return FS.toast('מעלים קודם את ההזמנה');
    var f = FS.fmt(fmt), k = 1800 / Math.max(f.w, f.h), W = Math.round(f.w * k), H = Math.round(f.h * k);
    FS.busy('בונה מסגרת מההזמנה…');
    setTimeout(function () {
      var r = FS.frameFromInvite(invImg, W, H, { border: $('#if-b').value / 100, band: $('#if-t').value / 100, accent: FS.accentOf(D.palette.length ? D.palette : [D.color]) });
      useInvCanvas(r.canvas, fmt, 'מסגרת מההזמנה').then(function () {
        FS.toast('🖼️ המסגרת נבנתה מההזמנה (' + shapeName(fmt) + '). השמות והתאריך מהלשונית "טקסט".', 5000);
      });
    }, 30);
  }
  function shapeName(fmt) { return fmt === 'magnetL' ? 'לרוחב' : fmt === 'm66' ? 'ריבוע' : 'לאורך'; }
  /* a frame canvas (with its see-through window) becomes the design's frame */
  function useInvCanvas(canvas, fmt, name) {
    var key = 'inv' + FS.uid(), src;
    return FS.canvasURL(canvas, 'image/webp', 0.9).then(function (u) { src = u; return FS.addUserFrame(src, name, false); }).then(function (u) {
      PNGS.filter(function (x) { return /^inv/.test(x.key); }).forEach(function (x) { var o = FS.USER_FRAMES[x.id]; if (o) { delete FS.IMGS[o.src]; delete FS.USER_FRAMES[x.id]; } });
      PNGS = PNGS.filter(function (x) { return !/^inv/.test(x.key); }); PNGS.push({ id: u.id, key: key, name: name, for: [] });
      D.invFrame = { key: key, src: src, name: name }; D.frame = 'png:' + key; D.fmt = fmt;
      if (D.deco.some(function (o) { return o.auto; })) D.deco = D.deco.filter(function (o) { return !o.auto; });
      FS.busy(); thumbs = {}; toForm(); changed();
    });
  }
  /* the AI frame: the image model paints a frame in the invitation's design; every result stays here to pick from */
  var AIF = [];
  function aiErr(m) {
    m = String(m || '');
    return m === 'no-window' ? 'ה־AI לא השאיר חלון לתמונה הפעם. לוחצים שוב לגרסה חדשה.' : m === 'quota' ? 'מכסת התמונות היומית של שרת ה־AI נגמרה. מתאפסת בלילה.' : m === 'rate-limited' ? 'יותר מדי בקשות בשעה האחרונה. נסו שוב בעוד כמה דקות.' : m === 'offline' || m === 'timeout' ? 'אין חיבור לשרת ה־AI. בודקים אינטרנט ומנסים שוב.' : 'ה־AI לא הצליח הפעם. מנסים שוב.';
  }
  function aiFrame(fmt) {
    if (!invImg) return FS.toast('מעלים קודם את ההזמנה');
    var f = FS.fmt(fmt), k = 1800 / Math.max(f.w, f.h), W = Math.round(f.w * k), H = Math.round(f.h * k);
    FS.busy('🤖 ה־AI מצייר מסגרת ' + shapeName(fmt) + ' בעיצוב של ההזמנה… (עד דקה)');
    FS.aiFrameFromInvite(invImg, W, H, { round: $('#ai-round').checked, band: true }).then(function (r) {
      AIF.unshift({ canvas: r.canvas, fmt: fmt }); drawAIF();
      return useInvCanvas(r.canvas, fmt, 'מסגרת AI מההזמנה').then(function () { FS.toast('🤖 מסגרת ' + shapeName(fmt) + ' מוכנה. לא אהבת? לוחצים שוב לגרסה אחרת, וכל הגרסאות נשארות למטה.', 6000); });
    }).catch(function (e) { FS.busy(); FS.toast(aiErr(e && e.message), 7000); });
  }
  function drawAIF() {
    var box = $('#ai-frames'); box.innerHTML = '';
    AIF.forEach(function (a, i) {
      var b = document.createElement('button'); b.className = 'dz-aif' + (i === 0 ? ' on' : ''); b.title = 'להשתמש במסגרת הזאת';
      var t = FS.canvas(160, Math.round(160 * a.canvas.height / a.canvas.width)); t.getContext('2d').drawImage(a.canvas, 0, 0, t.width, t.height); b.appendChild(t);
      b.addEventListener('click', function () { $$('.dz-aif', box).forEach(function (x) { x.classList.toggle('on', x === b); }); FS.busy('מחליף מסגרת…'); useInvCanvas(a.canvas, a.fmt, 'מסגרת AI מההזמנה'); });
      box.appendChild(b);
    });
  }
  /* the same frame made in the owner's own ChatGPT / Gemini: the invitation in the frame's shape and the instruction, then
     the answer is uploaded back and its green window cut out here */
  var EXT = { port: null, land: 'magnetL', square: 'm66' }, extShape = 'port';
  function extFmt() { return EXT[extShape] || (/^(magnet|m69|m710)$/.test(D.fmt) ? D.fmt : 'magnet'); }
  function extSize() { var f = FS.fmt(extFmt()), k = 1800 / Math.max(f.w, f.h); return [Math.round(f.w * k), Math.round(f.h * k)]; }
  function extPrompt() { var z = extSize(); return 'Generate an image. ' + FS.invFramePrompt(z[0], z[1], { round: $('#ai-round').checked, band: true }); }
  function extBlob() { var z = extSize(); return new Promise(function (ok) { FS.invShot(invImg, 1536, z[0], z[1]).toBlob(ok, 'image/jpeg', 0.92); }); }
  $$('[data-ext]').forEach(function (b) { b.addEventListener('click', function () { extShape = b.dataset.ext; $$('[data-ext]').forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
  $('#ext-img').addEventListener('click', function () {
    if (!invImg) return FS.toast('מעלים קודם את ההזמנה');
    extBlob().then(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'הזמנה-למסגרת.jpg'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); FS.toast('⬇ ההזמנה ירדה. עכשיו מעתיקים את ההוראה.'); });
  });
  $('#ext-copy').addEventListener('click', function () {
    var t = extPrompt();
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { FS.toast('📋 ההוראה הועתקה. פותחים את ChatGPT או Gemini, מצרפים את התמונה ומדביקים.', 6000); }, function () { window.prompt('מעתיקים את ההוראה:', t); });
  });
  if (navigator.canShare && window.File && navigator.canShare({ files: [new File([''], 'a.jpg', { type: 'image/jpeg' })] })) {
    $('#ext-share').hidden = false;
    $('#ext-share').addEventListener('click', function () {
      if (!invImg) return FS.toast('מעלים קודם את ההזמנה');
      extBlob().then(function (b) { return navigator.share({ files: [new File([b], 'invitation.jpg', { type: 'image/jpeg' })], text: extPrompt() }); }).catch(function () {});
    });
  }
  $('#ext-file').addEventListener('change', function () {
    var f = this.files[0]; this.value = ''; if (!f) return;
    var z = extSize(), fmt = extFmt(); FS.busy('חותך את החלון לתמונה…');
    FS.loadImg(URL.createObjectURL(f)).then(function (im) {
      var w = im.naturalWidth, h = im.naturalHeight, want = z[0] / z[1], got = w / h;
      if (Math.abs(Math.log(got / want)) > 0.25) { fmt = got > 1.15 ? 'magnetL' : got < 0.87 ? (/^(magnet|m69|m710)$/.test(D.fmt) ? D.fmt : 'magnet') : 'm66'; var ff = FS.fmt(fmt), kk = 1800 / Math.max(ff.w, ff.h); z = [Math.round(ff.w * kk), Math.round(ff.h * kk)]; }
      var r = FS.keyGreenWindow(im, z[0], z[1]);
      if (!r) { FS.busy(); return FS.toast('לא מצאתי חלון ירוק בתמונה. מבקשים שם: "the photo window must be solid pure green #00FF00" ומעלים שוב.', 8000); }
      AIF.unshift({ canvas: r.canvas, fmt: fmt }); drawAIF();
      return useInvCanvas(r.canvas, fmt, 'מסגרת מההזמנה').then(function () { FS.toast('🖼️ המסגרת נכנסה. את השמות והתאריך מוסיפים בלשונית "טקסט".', 6000); });
    }).catch(function () { FS.busy(); FS.toast('לא הצלחתי לפתוח את הקובץ'); });
  });
  /* the invitation itself as the magnet: the window where the owner marked it, the magnet size closest to the invitation */
  var imShape = 'round', imEdge = 'line', IM = null, imT = 0;
  var IM_DEF = { x: 0.17, y: 0.2, w: 0.66, h: 0.44 };
  function opt(attr, v) { $$('[' + attr + ']').forEach(function (x) { x.classList.toggle('on', x.getAttribute(attr) === v); }); }
  $$('[data-im]').forEach(function (b) { b.addEventListener('click', function () { imShape = b.dataset.im; opt('data-im', imShape); if (IM) { IM.shape = imShape; imSoon(0); } }); });
  $$('[data-edge]').forEach(function (b) { b.addEventListener('click', function () { imEdge = b.dataset.edge; opt('data-edge', imEdge); if (IM) { IM.edge = imEdge; imSoon(0); } }); });
  /* the magnet size closest to the invitation's proportions, and the window's proportions on the invitation for a photo */
  function imFormat() {
    var ar = (invImg.naturalWidth || invImg.width) / (invImg.naturalHeight || invImg.height), best = null;
    FMTS.forEach(function (f) { var d = Math.abs(Math.log((f.w / f.h) / ar)); if (!best || d < best.d) best = { f: f, d: d }; });
    return best.f;
  }
  function imPlace(kind) {
    var ar = (invImg.naturalWidth || invImg.width) / (invImg.naturalHeight || invImg.height), port = ar < 1;
    var aspect = port ? 0.8 : 1.3;   /* a photo-shaped window: 4:5 on a tall invitation, about 4:3 on a wide one */
    function sized(area) { var w = Math.sqrt(area * aspect / ar), h = w * ar / aspect; if (w > 0.9) { h *= 0.9 / w; w = 0.9; } if (h > 0.9) { w *= 0.9 / h; h = 0.9; } return { w: w, h: h }; }
    if (kind === 'smart') return FS.invSmartWindow(invImg, aspect, 0.34);
    var z = sized(kind === 'big' ? 0.62 : 0.36);
    return { x: (1 - z.w) / 2, y: kind === 'top' ? 0.08 : kind === 'bottom' ? 0.92 - z.h : (1 - z.h) / 2, w: z.w, h: z.h };
  }
  function imBuild(first) {
    if (!IM || !invImg) return Promise.resolve();
    var f = IM.f, k = 1800 / Math.max(f.w, f.h), W = Math.round(f.w * k), H = Math.round(f.h * k);
    var r = FS.inviteAsMagnet(invImg, W, H, IM.rect, IM.shape, IM.edge);
    IM.map = r.map; FS.invWindow = Object.assign({}, IM.rect);
    if (first || !AIF.length || AIF[0] !== IM.entry) { IM.entry = { canvas: r.canvas, fmt: f.id }; AIF.unshift(IM.entry); } else IM.entry.canvas = r.canvas;
    drawAIF(); imShow();
    return useInvCanvas(r.canvas, f.id, 'ההזמנה כמגנט').then(function () { IM.key = D.invFrame.key; render(); });
  }
  /* each change rebuilds the magnet a moment after the last one, so sliders stay smooth */
  function imSoon(ms) { if (!IM) return; clearTimeout(imT); imT = setTimeout(function () { imBuild(false); }, ms == null ? 160 : ms); }
  /* a window moved on the magnet (page fractions) back onto the invitation */
  function imFromPage(w) {
    if (!IM || !IM.map || !w) return render(); var M = IM.map;
    var x = (w.x - M.ox) / M.sw, y = (w.y - M.oy) / M.sh, ww = w.w / M.sw, hh = w.h / M.sh;
    x = Math.max(0, x); y = Math.max(0, y); ww = Math.min(1 - x, ww); hh = Math.min(1 - y, hh);
    IM.rect = { x: x, y: y, w: ww, h: hh }; imShow(); imBuild(false);
  }
  function imCreate(kind) {
    if (!invImg) return FS.toast('מעלים קודם את ההזמנה');
    FS.busy('יוצר את המגנט מההזמנה…');
    setTimeout(function () {
      IM = { f: imFormat(), rect: kind ? imPlace(kind) : Object.assign({}, FS.invWindow || imPlace('smart')), shape: imShape, edge: imEdge };
      D.names = ''; D.date = ''; D.line = ''; D.lay = {};   /* the invitation already carries its own names and date */
      $('#im-state').textContent = '✓ המגנט מוכן. גוררים את החלון בפינות או בקצה שלו, ישירות על המגנט או על ההזמנה.';
      imBuild(true).then(function () { FS.toast('💌 המגנט מההזמנה מוכן. אפשר להזיז ולשנות גודל לחלון, לתמונה, לטקסטים ולקישוטים.', 6500); });
    }, 30);
  }
  $('#im-go').addEventListener('click', function () { imCreate(IM ? null : 'smart'); });
  $$('[data-place]').forEach(function (b) { b.addEventListener('click', function () {
    if (!invImg) return FS.toast('מעלים קודם את ההזמנה');
    opt('data-place', b.dataset.place);
    if (!IM) return imCreate(b.dataset.place);
    IM.rect = imPlace(b.dataset.place); imShow(); imSoon(0);
  }); });
  ['w', 'h', 'x', 'y'].forEach(function (k) {
    $('#im-' + k).addEventListener('input', function () {
      if (!IM) return; var r = IM.rect, v = this.value / 100, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (k === 'w') r.w = v; else if (k === 'h') r.h = v; else if (k === 'x') cx = v; else cy = v;
      r.x = Math.max(0, Math.min(1 - r.w, cx - r.w / 2)); r.y = Math.max(0, Math.min(1 - r.h, cy - r.h / 2));
      imShow(); imSoon();
    });
  });
  function imScale(m) {
    if (!IM) return; var r = IM.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    r.w = Math.max(0.1, Math.min(0.96, r.w * m)); r.h = Math.max(0.1, Math.min(0.96, r.h * m));
    r.x = Math.max(0, Math.min(1 - r.w, cx - r.w / 2)); r.y = Math.max(0, Math.min(1 - r.h, cy - r.h / 2));
    imShow(); imSoon(0);
  }
  $('#im-bigger').addEventListener('click', function () { imScale(1.1); });
  $('#im-smaller').addEventListener('click', function () { imScale(1 / 1.1); });
  /* the photo inside the window: bigger or smaller and moved, on the preview (the studio does the same for every real photo) */
  function pzOut() { $('#pz-s').value = Math.round(PZ.s * 100); $('#pz-s-o').textContent = Math.round(PZ.s * 100) + '%'; }
  $('#pz-s').addEventListener('input', function () { PZ.s = this.value / 100; pzOut(); render(); });
  $('#pz-reset').addEventListener('click', function () { PZ.s = 1; PZ.dx = 0; PZ.dy = 0; pzOut(); render(); });
  pzOut();
  $('#ai-port').addEventListener('click', function () { aiFrame(/^(magnet|m69|m710)$/.test(D.fmt) ? D.fmt : 'magnet'); });
  $('#ai-land').addEventListener('click', function () { aiFrame('magnetL'); });
  $('#ai-square').addEventListener('click', function () { aiFrame('m66'); });
  $('#if-port').addEventListener('click', function () { invFrame(/^(magnet|m69|m710)$/.test(D.fmt) ? D.fmt : 'magnet'); });
  $('#if-land').addEventListener('click', function () { invFrame('magnetL'); });
  $('#if-square').addEventListener('click', function () { invFrame('m66'); });

  /* ---------- elements drawn in code: add, move, size, delete ---------- */
  function elems() {
    var box = $('#elems'), col = $('#el-color').value;
    box.innerHTML = '';
    FS.ELEMENTS.forEach(function (e) {
      var b = document.createElement('button'); b.className = 'dz-el'; b.title = e[1];
      var c = FS.elementCanvas(e[0], col); var t = FS.canvas(64, 64), x = t.getContext('2d'), k = Math.min(56 / c.width, 56 / c.height); x.drawImage(c, (64 - c.width * k) / 2, (64 - c.height * k) / 2, c.width * k, c.height * k);
      b.appendChild(t); var sm = document.createElement('small'); sm.textContent = e[1]; b.appendChild(sm);
      b.addEventListener('click', function () { addDeco(FS.elementCanvas(e[0], $('#el-color').value), { label: e[1], w: e[2] === 'wide' ? 0.42 : 0.16, y: e[2] === 'wide' ? 0.06 : 0.12 }).then(function () { FS.toast('נוסף: ' + e[1] + '. גוררים אותו על המגנט.'); }); });
      box.appendChild(b);
    });
  }
  $('#el-color').addEventListener('change', elems);
  document.addEventListener('keydown', function (e) { if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !/input|textarea|select/i.test(e.target.tagName)) { e.preventDefault(); $('#d-del').click(); } });
  $('#el-text-go').addEventListener('click', function () {
    var t = $('#el-text').value.trim(); if (!t) return FS.toast('כותבים טקסט');
    (document.fonts ? document.fonts.load('700 40px "' + D.font + '"').catch(function () {}) : Promise.resolve()).then(function () {
      addDeco(FS.textCanvas(t, D.font, $('#el-color').value, 700), { label: t, w: 0.45, y: 0.1 }); $('#el-text').value = '';
    });
  });
  $('#el-clear').addEventListener('click', function () { if (!D.deco.length) return; if (!confirm('למחוק את כל ' + D.deco.length + ' האלמנטים מהמסגרת?')) return; D.deco = []; sel = null; decos(); changed(); });
  elems();

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
        (l.length ? l.map(function (x) { return '<figure data-id="' + esc(x.id) + '"><img src="' + esc(x.thumb || '') + '" alt=""><figcaption><b>' + esc(x.name) + '</b><small>' + (x.approved ? '✅ אושר · ' : '') + (x.cloud ? '☁️ ' : '💻 ') + new Date(x.at).toLocaleDateString('he-IL') + '</small></figcaption><div><button class="btn small" data-open>פתיחה</button><button class="btn small danger" data-del>מחיקה</button></div></figure>'; }).join('') : '<p class="hint">עוד לא נשמרו עיצובים.</p>');
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

  /* ---------- step by step: a "next" button at the end of each step, ending at the approval ---------- */
  var NEXT = { frame: ['text', 'הבא: שמות, טקסט וצבע'], text: ['deco', 'הבא: עיטורים (לא חובה)'], invite: ['text', 'הבא: שמות, טקסט וצבע'], ai: ['deco', 'הבא: עיטורים'], deco: ['save', 'הבא: אישור ושליחה'] };
  Object.keys(NEXT).forEach(function (k) {
    var pane = $('.dz-pane[data-pane="' + k + '"]'); if (!pane) return;
    var b = document.createElement('button'); b.className = 'btn gold wide dz-next'; b.textContent = NEXT[k][1] + ' ←';
    b.addEventListener('click', function () { var t = $('.dz-tabs [data-tab="' + NEXT[k][0] + '"]'); if (t) { t.click(); t.scrollIntoView({ block: 'nearest', inline: 'center' }); } $('#panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    pane.appendChild(b);
  });
  $('#guides').addEventListener('click', function () { guides = !guides; this.setAttribute('aria-pressed', String(guides)); this.classList.toggle('on', guides); render(); });

  /* ---------- approving: the print frame goes to the studio (the customer's account is needed, so it is theirs) ---------- */
  function apStatus() {
    var st = $('#ap-st'); if (!st) return;
    st.innerHTML = D && D.approved ? '✅ העיצוב אושר ונשלח אלינו ב־' + esc(new Date(D.approved).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })) + '. שיניתם משהו? מאשרים שוב והגרסה החדשה מחליפה את הקודמת.' : '';
    if (D && /^\d{4}-\d{2}-\d{2}$/.test(D.date || '') && !$('#ap-date').value) $('#ap-date').value = D.date;
  }
  function frameB64() {
    return snapshot(2400, true).then(function (c) {
      var u = c.toDataURL('image/png'); if (u.length < 4100000) return u;
      return snapshot(1800, true).then(function (c2) { return c2.toDataURL('image/png'); });
    }).then(function (u) { return u.split(',')[1]; });
  }
  $('#ap-go').addEventListener('click', function () {
    if (!$('#ap-ok').checked) { FS.toast('מסמנים שבדקתם את השמות, התאריך והאיות'); $('#ap-ok').focus(); return; }
    if (!cloud()) { FS.toast('כדי לשלוח לצלם נכנסים לחשבון (או נרשמים, לוקח דקה). העיצוב נשמר.', 6000); save(true); openAcc(); return; }
    var btn = this; btn.disabled = true; FS.busy('שולח את העיצוב לצלם…');
    save(true).then(function () { return Promise.all([frameB64(), snapshot(1100)]); }).then(function (r) {
      return ACC.call('design-approve', { id: D.id, frame: r[0], preview: r[1].toDataURL('image/jpeg', 0.85).split(',')[1], eventDate: $('#ap-date').value, phone: $('#ap-phone').value.trim(), note: $('#ap-note').value.trim() });
    }).then(function (r) {
      FS.busy(); btn.disabled = false;
      if (!r || !r.ok) return FS.toast('השליחה לא הצליחה: ' + (ACC ? ACC.msg(r) : ''), 6000);
      D.approved = r.at; apStatus(); FS.toast('✅ העיצוב אושר ונשלח! נחזור אליכם אם יהיו שאלות.', 6000); mine();
    }).catch(function () { FS.busy(); btn.disabled = false; FS.toast('השליחה לא הצליחה. נסו שוב.'); });
  });

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
