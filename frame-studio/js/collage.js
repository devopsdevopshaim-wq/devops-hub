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
    if (SPECIAL[mode]) return [SPECIAL[mode](items, W, H, gap, r)];
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

  /* ---------- special arrangements (shapes and scattered cards, not just straight cuts) ---------- */
  function gridOf(n, W, H, ar) {
    var best = null;
    for (var cols = 1; cols <= n; cols++) { var rows = Math.ceil(n / cols), s = Math.abs(Math.log((W / cols) / (H / rows) / ar)) + (rows * cols - n) * 0.2; if (!best || s < best.s) best = { s: s, cols: cols, rows: rows }; }
    return best;
  }
  var SPECIAL = {
    /* polaroid cards thrown on the table: white card, wide bottom edge, each a little turned */
    polaroid: function (items, W, H, gap, r) {
      var n = items.length, g = gridOf(n, W, H, 0.84), cw = W / g.cols, ch = H / g.rows, out = [];
      items.forEach(function (it, k) {
        var row = Math.floor(k / g.cols), col = k % g.cols, inRow = Math.min(g.cols, n - row * g.cols), off = (g.cols - inRow) * cw / 2;
        var w = Math.min(cw * 1.06, ch * 1.06 * 0.84), h = w / 0.84, cx = off + (col + 0.5) * cw + (r() - 0.5) * cw * 0.12, cy = (row + 0.5) * ch + (r() - 0.5) * ch * 0.1;
        cx = Math.max(w / 2, Math.min(W - w / 2, cx)); cy = Math.max(h / 2, Math.min(H - h / 2, cy));
        out.push({ i: it.i, ar: it.ar, x: cx - w / 2, y: cy - h / 2, w: w, h: h, rot: (r() - 0.5) * 0.24, card: 'polaroid' });
      });
      return out;
    },
    /* film strips with sprocket holes: down the page when it stands, across when it lies */
    film: function (items, W, H, gap) {
      var n = items.length, vert = H >= W, L = vert ? W : H, D = vert ? H : W, strips = n <= 4 ? 1 : n <= 10 ? 2 : 3;
      strips = Math.min(strips, Math.max(1, Math.floor(L / 30)));
      var g = Math.max(gap, 3), sw = (L - g * (strips - 1)) / strips, per = Math.ceil(n / strips), side = sw * 0.12, pad = sw * 0.05, out = [], under = [];
      for (var s2 = 0; s2 < strips; s2++) {
        var a = s2 * (sw + g); under.push(vert ? { film: 1, x: a, y: 0, w: sw, h: D, vert: true } : { film: 1, x: 0, y: a, w: D, h: sw, vert: false });
        var cnt = Math.min(per, n - s2 * per); if (cnt <= 0) continue;
        var fl = (D - pad * (cnt + 1)) / cnt;
        for (var j = 0; j < cnt; j++) {
          var it = items[s2 * per + j], b = pad + j * (fl + pad);
          out.push(vert ? { i: it.i, ar: it.ar, x: a + side, y: b, w: sw - side * 2, h: fl, shape: 'rect' } : { i: it.i, ar: it.ar, x: b, y: a + side, w: fl, h: sw - side * 2, shape: 'rect' });
        }
      }
      out.under = under; return out;
    },
    /* one big heart made of small square photos (they repeat to fill it) */
    heart: function (items, W, H, gap, r) {
      var n = items.length, S = Math.min(W, H) / 2, cx = W / 2, cy = H / 2, want = Math.max(n * 2, 56), cells = [];
      function inside(px, py) { var u = (px - cx) / S * 1.2, v = (cy - py) / S * 1.2 + 0.12, q = u * u + v * v - 1; return q * q * q - u * u * v * v * v <= 0; }
      for (var c = S / 2; c > 2; c *= 0.95) {
        cells = []; var cols = Math.floor(W / c), rows = Math.floor(H / c), ox = (W - cols * c) / 2, oy = (H - rows * c) / 2;
        for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) { var px = ox + (x + 0.5) * c, py = oy + (y + 0.5) * c; if (inside(px, py)) cells.push({ x: px - c / 2 + gap / 2, y: py - c / 2 + gap / 2, w: c - gap, h: c - gap }); }
        if (cells.length >= want) break;
      }
      var order = shuffle(items, r);
      return cells.map(function (q, k) { var it = order[k % n]; q.i = it.i; q.ar = it.ar; return q; });
    },
    /* a flower: one big round photo in the middle, the others in a ring around it */
    circle: function (items, W, H, gap) {
      var n = items.length, S = Math.min(W, H) / 2, cx = W / 2, cy = H / 2, out = [];
      if (n <= 3) {
        var d = Math.min((W - gap * (n - 1)) / n, H); items.forEach(function (it, k) { var x0 = (W - (d * n + gap * (n - 1))) / 2 + k * (d + gap); out.push({ i: it.i, ar: it.ar, x: x0, y: cy - d / 2, w: d, h: d, shape: 'circle' }); });
        return out;
      }
      var m = n - 1, sn = Math.sin(Math.PI / m), rr2 = Math.min(S * 0.3, (S * sn - gap / 2) / (1 + sn)), D = S - rr2, R0 = Math.max(S * 0.2, D - rr2 - gap);
      out.push({ i: items[0].i, ar: items[0].ar, x: cx - R0, y: cy - R0, w: R0 * 2, h: R0 * 2, shape: 'circle' });
      for (var k = 0; k < m; k++) { var t = -Math.PI / 2 + k * 2 * Math.PI / m, px = cx + Math.cos(t) * D, py = cy + Math.sin(t) * D; out.push({ i: items[k + 1].i, ar: items[k + 1].ar, x: px - rr2, y: py - rr2, w: rr2 * 2, h: rr2 * 2, shape: 'circle' }); }
      return out;
    },
    /* a honeycomb of six-sided photos */
    hex: function (items, W, H, gap) {
      var n = items.length, best = null;
      for (var R = Math.min(W, H) / 2; R > 2; R *= 0.95) {
        var hw = Math.sqrt(3) * R, list = [], rows = Math.floor((H - R * 2) / (1.5 * R)) + 1;
        for (var y = 0; y < rows; y++) { var odd = y % 2, cols = Math.floor((W - (odd ? hw / 2 : 0)) / hw); for (var x = 0; x < cols; x++) list.push({ cx: (odd ? hw / 2 : 0) + hw * (x + 0.5), cy: R + y * 1.5 * R }); }
        if (list.length >= n) { best = { R: R, hw: hw, list: list }; break; }
      }
      if (!best) return SPECIAL.polaroid(items, W, H, gap, rnd(3));
      var L = best.list, mx = 0, my = 0;
      L.forEach(function (c) { mx = Math.max(mx, c.cx + best.hw / 2); my = Math.max(my, c.cy + best.R); });
      var ox = (W - mx) / 2, oy = (H - my) / 2, mid = { x: W / 2, y: H / 2 };
      L.sort(function (a, b) { return Math.hypot(a.cx + ox - mid.x, a.cy + oy - mid.y) - Math.hypot(b.cx + ox - mid.x, b.cy + oy - mid.y); });
      var r2 = best.R - gap / 2;
      return items.map(function (it, k) { var c = L[k]; return { i: it.i, ar: it.ar, x: c.cx + ox - Math.sqrt(3) * r2 / 2, y: c.cy + oy - r2, w: Math.sqrt(3) * r2, h: r2 * 2, shape: 'hex' }; });
    }
  };

  /* ---------- drawing ---------- */
  /* the outline of one photo: straight, round, oval, heart, hexagon, arch or diamond, inside the cell (centred) */
  function shapeBox(sh, X, Y, w, h) {
    if (sh === 'circle' || sh === 'heart') { var d = Math.min(w, h); return { x: X + (w - d) / 2, y: Y + (h - d) / 2, w: d, h: d }; }
    if (sh === 'hex') { var R = Math.min(w / Math.sqrt(3), h / 2), hw = Math.sqrt(3) * R; return { x: X + (w - hw) / 2, y: Y + (h - R * 2) / 2, w: hw, h: R * 2 }; }
    return { x: X, y: Y, w: w, h: h };
  }
  function shapePath(x, sh, b, rad) {
    var X = b.x, Y = b.y, w = b.w, h = b.h, cx = X + w / 2, cy = Y + h / 2;
    x.beginPath();
    if (sh === 'circle') x.arc(cx, cy, w / 2, 0, Math.PI * 2);
    else if (sh === 'oval') x.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (sh === 'heart') {
      x.moveTo(cx, Y + h * 0.28);
      x.bezierCurveTo(cx, Y + h * 0.02, X, Y - h * 0.02, X, Y + h * 0.32);
      x.bezierCurveTo(X, Y + h * 0.6, cx - w * 0.12, Y + h * 0.78, cx, Y + h);
      x.bezierCurveTo(cx + w * 0.12, Y + h * 0.78, X + w, Y + h * 0.6, X + w, Y + h * 0.32);
      x.bezierCurveTo(X + w, Y - h * 0.02, cx, Y + h * 0.02, cx, Y + h * 0.28);
    } else if (sh === 'hex') { x.moveTo(cx, Y); x.lineTo(X + w, Y + h / 4); x.lineTo(X + w, Y + h * 3 / 4); x.lineTo(cx, Y + h); x.lineTo(X, Y + h * 3 / 4); x.lineTo(X, Y + h / 4); }
    else if (sh === 'arch') { var ar2 = Math.min(w / 2, h); x.moveTo(X, Y + h); x.lineTo(X, Y + ar2); x.arc(cx, Y + ar2, w / 2, Math.PI, 0); x.lineTo(X + w, Y + h); }
    else if (sh === 'diamond') { x.moveTo(cx, Y); x.lineTo(X + w, cy); x.lineTo(cx, Y + h); x.lineTo(X, cy); }
    else if (rad) FS.roundRect(x, X, Y, w, h, Math.min(rad, w / 2, h / 2));
    else x.rect(X, Y, w, h);
    x.closePath();
  }
  /* the page background: one colour, a soft glow, dots or paper */
  function paintBg(x, W, H, o, u) {
    x.fillStyle = o.bg; x.fillRect(0, 0, W, H);
    var st = o.bgStyle || 'solid';
    if (st === 'soft') { var g = x.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(0,0,0,.22)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    else if (st === 'dots') { x.fillStyle = 'rgba(0,0,0,.09)'; var st2 = 6 * u; for (var yy = st2 / 2, row = 0; yy < H; yy += st2, row++) for (var xx = (row % 2 ? st2 / 2 : 0) + st2 / 4; xx < W; xx += st2) { x.beginPath(); x.arc(xx, yy, 0.7 * u, 0, Math.PI * 2); x.fill(); } }
    else if (st === 'paper') { var r = rnd(11), k2 = Math.round(W * H / (90 * u * u)); for (var i = 0; i < Math.min(k2, 60000); i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'; x.fillRect(r() * W, r() * H, 0.5 * u, 0.5 * u); } var gv = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(90,60,20,.16)'); x.fillStyle = gv; x.fillRect(0, 0, W, H); }
    else if (st === 'stripes') { x.save(); x.strokeStyle = 'rgba(0,0,0,.06)'; x.lineWidth = 2 * u; for (var d = -H; d < W; d += 7 * u) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + H, H); x.stroke(); } x.restore(); }
  }
  function filmStrip(x, f, u) {
    x.save(); x.fillStyle = '#141414'; x.fillRect(f.x, f.y, f.w, f.h);
    var t = f.vert ? f.w : f.h, len = f.vert ? f.h : f.w, hole = t * 0.06, step = hole * 2.4, edge = t * 0.03; x.fillStyle = '#e9e4da';
    for (var a = step / 2; a < len - hole; a += step) {
      [edge, t - edge - hole].forEach(function (e) { var X = f.vert ? f.x + e : f.x + a, Y = f.vert ? f.y + a : f.y + e; x.beginPath(); FS.roundRect(x, X, Y, hole, hole, hole * 0.25); x.fill(); });
    }
    x.restore();
  }
  /* cover-crop around the faces (or the centre) into box b, clipped to the shape */
  function photoInto(x, p, b, sh, rad) {
    var im = FS.img(p.src); if (!im) return;
    var iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max(b.w / iw, b.h / ih), sw = b.w / s, sh2 = b.h / s, cx = iw / 2, cy = ih / 2;
    if (p.faces && p.faces.length) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; p.faces.forEach(function (f) { x0 = Math.min(x0, f.x); y0 = Math.min(y0, f.y); x1 = Math.max(x1, f.x + f.w); y1 = Math.max(y1, f.y + f.h); }); cx = (x0 + x1) / 2; cy = (y0 + y1) / 2 + (y1 - y0) * 0.15; }
    var sx = Math.max(0, Math.min(iw - sw, cx - sw / 2)), sy = Math.max(0, Math.min(ih - sh2, cy - sh2 / 2));
    x.save(); shapePath(x, sh, b, rad); x.clip(); x.drawImage(im, sx, sy, sw, sh2, b.x, b.y, b.w, b.h); x.restore();
  }
  function drawCell(x, p, q, ox, oy, rad, o, u) {
    var sh = q.shape || o.shape || 'rect', X = ox + q.x, Y = oy + q.y;
    x.save();
    if (q.rot) { x.translate(X + q.w / 2, Y + q.h / 2); x.rotate(q.rot); X = -q.w / 2; Y = -q.h / 2; }
    if (q.card === 'polaroid') {
      var m = q.w * 0.06, card = { x: X, y: Y, w: q.w, h: q.h };
      x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 3 * u; x.shadowOffsetY = 1.2 * u; x.fillStyle = '#fbfaf6'; shapePath(x, 'rect', card, 0); x.fill(); x.restore();
      photoInto(x, p, { x: X + m, y: Y + m, w: q.w - m * 2, h: q.h - m - q.h * 0.2 }, 'rect', 0);
      x.restore(); return;
    }
    var b = shapeBox(sh, X, Y, q.w, q.h), deco = o.deco || 'none';
    if (deco === 'shadow' || deco === 'border') {
      x.save(); x.shadowColor = 'rgba(0,0,0,' + (deco === 'shadow' ? '.4' : '.25') + ')'; x.shadowBlur = (deco === 'shadow' ? 4 : 2) * u; x.shadowOffsetY = (deco === 'shadow' ? 1.6 : 0.6) * u;
      x.fillStyle = deco === 'border' ? '#ffffff' : o.bg; shapePath(x, sh, b, rad); x.fill(); x.restore();
    }
    if (deco === 'border') { var bw = Math.max(1.2 * u, Math.min(b.w, b.h) * 0.045), k = 1 - bw * 2 / Math.min(b.w, b.h); b = { x: b.x + b.w * (1 - k) / 2, y: b.y + b.h * (1 - k) / 2, w: b.w * k, h: b.h * k }; rad = rad * k; }
    photoInto(x, p, b, sh, rad);
    if (deco === 'gold' || deco === 'line') {
      x.lineWidth = Math.max(1, 0.7 * u); x.strokeStyle = deco === 'gold' ? '#c9a45c' : o.ink;
      var i2 = 1.6 * u, bi = { x: b.x + i2, y: b.y + i2, w: b.w - i2 * 2, h: b.h - i2 * 2 };
      if (sh === 'rect' && !rad) { shapePath(x, sh, bi, 0); x.stroke(); } else { shapePath(x, sh, b, rad); x.lineWidth = Math.max(1.5, 1.1 * u); x.stroke(); }
    }
    x.restore();
  }
  /* the page: margin, background, cells, an optional title band */
  FS.drawCollage = function (photos, cells, o, scale) {
    var W = Math.round(o.W * scale), H = Math.round(o.H * scale), c = FS.canvas(W, H), x = c.getContext('2d');
    paintBg(x, W, H, o, scale); x.imageSmoothingQuality = 'high';
    var m = o.margin * scale, band = o.title ? H * 0.11 : 0, k = (W - m * 2) / o.boxW, oy = m + (o.titleTop ? band : 0);
    (cells.under || []).forEach(function (f) { if (f.film) filmStrip(x, { x: m + f.x * k, y: oy + f.y * k, w: f.w * k, h: f.h * k, vert: f.vert }, scale); });
    cells.forEach(function (q) { var s = { x: q.x * k, y: q.y * k, w: q.w * k, h: q.h * k, shape: q.shape, rot: q.rot, card: q.card }; drawCell(x, photos[q.i], s, m, oy, o.radius * scale, o, scale); });
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
    '<div class="field"><label>סידור</label><div class="chips" id="cl-mode"><button data-m="auto" class="on">אוטומטי מושלם</button><button data-m="hero">תמונה ראשית גדולה</button><button data-m="grid">רשת אחידה</button>' +
    '<button data-m="polaroid">📸 פולארויד מפוזר</button><button data-m="film">🎞️ סרט צילום</button><button data-m="heart">❤️ לב מתמונות</button><button data-m="circle">🌸 פרח עגול</button><button data-m="hex">⬢ כוורת</button></div></div>' +
    '<div class="field"><label>צורת התמונות</label><div class="chips" id="cl-shape"><button data-s="rect" class="on">▭ מלבן</button><button data-s="circle">● עיגול</button><button data-s="oval">⬭ אליפסה</button><button data-s="heart">♥ לב</button><button data-s="hex">⬢ משושה</button><button data-s="arch">◠ קשת</button><button data-s="diamond">◆ יהלום</button></div></div>' +
    '<div class="field"><label>עיצוב התמונות</label><div class="chips" id="cl-deco"><button data-d="none" class="on">נקי</button><button data-d="border">מסגרת לבנה</button><button data-d="shadow">צל</button><button data-d="gold">קו זהב</button><button data-d="line">קו דק</button></div></div>' +
    '<div class="field"><label>סגנון הרקע</label><div class="chips" id="cl-bgs"><button data-b="solid" class="on">אחיד</button><button data-b="soft">זוהר רך</button><button data-b="paper">נייר</button><button data-b="dots">נקודות</button><button data-b="stripes">פסים</button></div>' +
    '<div class="cl-sw" id="cl-sw">' + ['#ffffff', '#f6f0e4', '#efe2d0', '#f4dcdc', '#dfe8e1', '#dfe6f1', '#2a2238', '#111111'].map(function (c) { return '<button style="background:' + c + '" data-c="' + c + '" title="' + c + '"></button>'; }).join('') + '</div></div>' +
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

  var pick = {}, mode = 'auto', layouts = [], li = 0, seed = 7, shape = 'rect', deco = 'none', bgStyle = 'solid';
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
    return { W: W, H: H, margin: margin, boxW: boxW, boxH: boxH, gap: Number($('#cl-gap').value), radius: Number($('#cl-rad').value), bg: $('#cl-bg').value, ink: $('#cl-ink').value, title: title, titleTop: false, shape: shape, deco: deco, bgStyle: bgStyle };
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
  function chipRow(sel, key, set) { $$(sel + ' button').forEach(function (b) { b.addEventListener('click', function () { set(b.dataset[key]); $$(sel + ' button').forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }); }); }
  chipRow('#cl-shape', 's', function (v) { shape = v; });
  chipRow('#cl-deco', 'd', function (v) { deco = v; });
  chipRow('#cl-bgs', 'b', function (v) { bgStyle = v; });
  $$('#cl-sw button').forEach(function (b) { b.addEventListener('click', function () { $('#cl-bg').value = b.dataset.c; var dark = /#(2a2238|111111)/.test(b.dataset.c); $('#cl-ink').value = dark ? '#f3e7cf' : '#2a2238'; draw(); }); });
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
