/* A whole frame made from the invitation itself, in the browser (no network): the invitation's own border is cut into nine
   parts (four corners, four edges, the middle) and rebuilt around the photo at any size, standing or lying: the corners keep
   their shape, the edges are repeated (mirrored, so the seams meet) to the new length, a band for the names takes the
   invitation's paper colour, and the photo window is cut see-through. FS.ELEMENTS are simple ornaments drawn in code
   (hearts, stars, flourishes…) in any colour, for a white frame built from scratch. */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {};

  /* the most common colour in a region (quantized), so text on the paper does not darken it */
  function modeColor(x, w, h, rx, ry, rw, rh) {
    var d = x.getImageData(Math.round(rx), Math.round(ry), Math.max(1, Math.round(rw)), Math.max(1, Math.round(rh))).data, cnt = {}, best = null, bn = 0;
    for (var i = 0; i < d.length; i += 16) {
      var k = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3);
      var n = (cnt[k] = (cnt[k] || 0) + 1); if (n > bn) { bn = n; best = k; }
    }
    var c = (best || '31,31,31').split(',').map(function (v) { return Math.min(255, Number(v) * 8 + 4); });
    return 'rgb(' + c.join(',') + ')';
  }
  /* one edge: the source strip repeated along the target length, every other copy mirrored */
  function edge(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, horizontal) {
    var along = horizontal ? sw : sh, across = horizontal ? sh : sw, target = horizontal ? dw : dh, thick = horizontal ? dh : dw;
    var piece = along * thick / across, n = Math.max(1, Math.round(target / piece)), len = target / n;
    for (var i = 0; i < n; i++) {
      ctx.save();
      if (horizontal) {
        ctx.translate(dx + i * len + (i % 2 ? len : 0), dy); if (i % 2) ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, len + 0.5, dh);
      } else {
        ctx.translate(dx, dy + i * len + (i % 2 ? len : 0)); if (i % 2) ctx.scale(1, -1);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, len + 0.5);
      }
      ctx.restore();
    }
  }
  /* img: the invitation · W, H: the page (any shape) · o: { border: share of the invitation that is its border (0.08–0.35),
     band: thickness of the frame on the page, text: extra band at the bottom for the names, accent: colour for the line } */
  FS.frameFromInvite = function (img, W, H, o) {
    o = o || {};
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, m = Math.min(iw, ih);
    var bi = Math.round(m * (o.border || 0.17)), M = Math.min(W, H), bt = Math.round(M * (o.band || 0.12)), extra = Math.round(Math.max(W, H) * (o.text == null ? 0.13 : o.text));
    var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    // the invitation's paper colour, from its middle, fills the whole page first
    var probe = document.createElement('canvas'); probe.width = Math.min(400, iw); probe.height = Math.round(probe.width * ih / iw);
    var px = probe.getContext('2d', { willReadFrequently: true }); px.drawImage(img, 0, 0, probe.width, probe.height);
    var paper = modeColor(px, probe.width, probe.height, probe.width * 0.2, probe.height * 0.2, probe.width * 0.6, probe.height * 0.6);
    x.fillStyle = paper; x.fillRect(0, 0, W, H);
    // nine parts: corners keep their shape, edges are repeated to length
    x.drawImage(img, 0, 0, bi, bi, 0, 0, bt, bt);
    x.drawImage(img, iw - bi, 0, bi, bi, W - bt, 0, bt, bt);
    x.drawImage(img, 0, ih - bi, bi, bi, 0, H - bt, bt, bt);
    x.drawImage(img, iw - bi, ih - bi, bi, bi, W - bt, H - bt, bt, bt);
    edge(x, img, bi, 0, iw - 2 * bi, bi, bt, 0, W - 2 * bt, bt, true);
    edge(x, img, bi, ih - bi, iw - 2 * bi, bi, bt, H - bt, W - 2 * bt, bt, true);
    edge(x, img, 0, bi, bi, ih - 2 * bi, 0, bt, bt, H - 2 * bt, false);
    edge(x, img, iw - bi, bi, bi, ih - 2 * bi, W - bt, bt, bt, H - 2 * bt, false);
    // the photo window, with a fine line in the invitation's accent colour around it
    var g = Math.round(M * 0.018), win = { x: bt + g, y: bt + g, w: W - 2 * (bt + g), h: H - 2 * (bt + g) - extra }, r = Math.round(M * 0.025);
    function path() { x.beginPath(); x.moveTo(win.x + r, win.y); x.arcTo(win.x + win.w, win.y, win.x + win.w, win.y + win.h, r); x.arcTo(win.x + win.w, win.y + win.h, win.x, win.y + win.h, r); x.arcTo(win.x, win.y + win.h, win.x, win.y, r); x.arcTo(win.x, win.y, win.x + win.w, win.y, r); x.closePath(); }
    if (o.accent) { x.save(); path(); x.lineWidth = Math.max(2, M * 0.006); x.strokeStyle = o.accent; x.translate(0, 0); x.stroke(); x.restore(); }
    x.save(); x.globalCompositeOperation = 'destination-out'; path(); x.fill(); x.restore();
    return { canvas: c, paper: paper, window: win };
  };

  /* ---------- simple ornaments drawn in code ---------- */
  function heart(x, s) { x.beginPath(); x.moveTo(s * 0.5, s * 0.82); x.bezierCurveTo(s * 0.1, s * 0.55, s * 0.05, s * 0.25, s * 0.28, s * 0.18); x.bezierCurveTo(s * 0.4, s * 0.14, s * 0.48, s * 0.22, s * 0.5, s * 0.3); x.bezierCurveTo(s * 0.52, s * 0.22, s * 0.6, s * 0.14, s * 0.72, s * 0.18); x.bezierCurveTo(s * 0.95, s * 0.25, s * 0.9, s * 0.55, s * 0.5, s * 0.82); x.fill(); }
  function star(x, s, n, inner) { x.beginPath(); for (var i = 0; i < n * 2; i++) { var a = -Math.PI / 2 + i * Math.PI / n, R = i % 2 ? s * 0.45 * inner : s * 0.45; x.lineTo(s / 2 + Math.cos(a) * R, s / 2 + Math.sin(a) * R); } x.closePath(); x.fill(); }
  FS.ELEMENTS = [
    ['heart', 'לב', 'square', function (x, s) { heart(x, s); }],
    ['hearts', 'שני לבבות', 'square', function (x, s) { x.save(); x.translate(-s * 0.12, s * 0.05); x.scale(0.75, 0.75); heart(x, s); x.restore(); x.save(); x.translate(s * 0.32, -s * 0.02); x.scale(0.6, 0.6); heart(x, s); x.restore(); }],
    ['star', 'כוכב', 'square', function (x, s) { star(x, s, 5, 0.45); }],
    ['sparkle', 'נצנוץ', 'square', function (x, s) { star(x, s, 4, 0.22); }],
    ['magen', 'מגן דוד', 'square', function (x, s) { x.lineWidth = s * 0.05; x.lineJoin = 'round'; [0, Math.PI].forEach(function (rot) { x.beginPath(); for (var i = 0; i < 3; i++) { var a = rot - Math.PI / 2 + i * 2 * Math.PI / 3; x.lineTo(s / 2 + Math.cos(a) * s * 0.42, s / 2 + Math.sin(a) * s * 0.42); } x.closePath(); x.stroke(); }); }],
    ['rings', 'טבעות', 'wide', function (x, s) { x.lineWidth = s * 0.05; x.beginPath(); x.arc(s * 0.38, s * 0.5, s * 0.22, 0, 7); x.stroke(); x.beginPath(); x.arc(s * 0.62, s * 0.5, s * 0.22, 0, 7); x.stroke(); }],
    ['flower', 'פרח', 'square', function (x, s) { for (var i = 0; i < 6; i++) { x.save(); x.translate(s / 2, s / 2); x.rotate(i * Math.PI / 3); x.beginPath(); x.ellipse(0, -s * 0.22, s * 0.11, s * 0.2, 0, 0, 7); x.fill(); x.restore(); } x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(s / 2, s / 2, s * 0.08, 0, 7); x.fill(); x.restore(); }],
    ['leaves', 'ענף עלים', 'wide', function (x, s) { x.lineWidth = s * 0.025; x.lineCap = 'round'; x.beginPath(); x.moveTo(s * 0.05, s * 0.55); x.quadraticCurveTo(s * 0.5, s * 0.35, s * 0.95, s * 0.5); x.stroke(); for (var i = 0; i < 7; i++) { var t = 0.12 + i * 0.12, px = s * (0.05 + t * 0.9), py = s * (0.55 - Math.sin(t * Math.PI) * 0.1); [-1, 1].forEach(function (sd) { x.save(); x.translate(px, py); x.rotate(sd * 0.9 - 0.3); x.beginPath(); x.ellipse(0, -s * 0.06 * sd, s * 0.025, s * 0.065, 0, 0, 7); x.fill(); x.restore(); }); } }],
    ['flourish', 'סלסול', 'wide', function (x, s) { x.lineWidth = s * 0.022; x.lineCap = 'round'; x.beginPath(); x.moveTo(s * 0.04, s * 0.5); x.bezierCurveTo(s * 0.2, s * 0.2, s * 0.35, s * 0.8, s * 0.5, s * 0.5); x.bezierCurveTo(s * 0.65, s * 0.2, s * 0.8, s * 0.8, s * 0.96, s * 0.5); x.stroke(); x.beginPath(); x.arc(s * 0.5, s * 0.5, s * 0.035, 0, 7); x.fill(); }],
    ['divider', 'קו מפריד', 'wide', function (x, s) { x.lineWidth = s * 0.012; x.beginPath(); x.moveTo(s * 0.04, s * 0.5); x.lineTo(s * 0.42, s * 0.5); x.moveTo(s * 0.58, s * 0.5); x.lineTo(s * 0.96, s * 0.5); x.stroke(); x.save(); x.translate(s / 2, s / 2); x.rotate(Math.PI / 4); x.fillRect(-s * 0.04, -s * 0.04, s * 0.08, s * 0.08); x.restore(); }],
    ['corner', 'פינה מעוטרת', 'square', function (x, s) { x.lineWidth = s * 0.035; x.lineCap = 'round'; x.beginPath(); x.moveTo(s * 0.08, s * 0.92); x.lineTo(s * 0.08, s * 0.2); x.quadraticCurveTo(s * 0.08, s * 0.08, s * 0.2, s * 0.08); x.lineTo(s * 0.92, s * 0.08); x.stroke(); x.beginPath(); x.moveTo(s * 0.2, s * 0.6); x.quadraticCurveTo(s * 0.2, s * 0.2, s * 0.6, s * 0.2); x.stroke(); x.beginPath(); x.arc(s * 0.3, s * 0.3, s * 0.05, 0, 7); x.fill(); }],
    ['balloons', 'בלונים', 'square', function (x, s) { [[0.32, 0.36, 0.17], [0.62, 0.3, 0.19], [0.5, 0.55, 0.15]].forEach(function (b) { x.beginPath(); x.ellipse(s * b[0], s * b[1], s * b[2] * 0.85, s * b[2], 0, 0, 7); x.fill(); }); x.lineWidth = s * 0.01; x.beginPath(); x.moveTo(s * 0.32, s * 0.53); x.lineTo(s * 0.5, s * 0.95); x.moveTo(s * 0.62, s * 0.49); x.lineTo(s * 0.5, s * 0.95); x.moveTo(s * 0.5, s * 0.7); x.lineTo(s * 0.5, s * 0.95); x.stroke(); }],
    ['crown', 'כתר', 'wide', function (x, s) { x.beginPath(); x.moveTo(s * 0.12, s * 0.72); x.lineTo(s * 0.12, s * 0.32); x.lineTo(s * 0.32, s * 0.52); x.lineTo(s * 0.5, s * 0.22); x.lineTo(s * 0.68, s * 0.52); x.lineTo(s * 0.88, s * 0.32); x.lineTo(s * 0.88, s * 0.72); x.closePath(); x.fill(); }],
    ['dots', 'נקודות', 'wide', function (x, s) { for (var i = 0; i < 9; i++) { x.beginPath(); x.arc(s * (0.08 + i * 0.105), s * 0.5, s * (i % 2 ? 0.018 : 0.03), 0, 7); x.fill(); } }],
    ['bow', 'פפיון', 'wide', function (x, s) { x.beginPath(); x.moveTo(s * 0.5, s * 0.5); x.bezierCurveTo(s * 0.3, s * 0.15, s * 0.05, s * 0.25, s * 0.12, s * 0.5); x.bezierCurveTo(s * 0.05, s * 0.75, s * 0.3, s * 0.85, s * 0.5, s * 0.5); x.bezierCurveTo(s * 0.7, s * 0.15, s * 0.95, s * 0.25, s * 0.88, s * 0.5); x.bezierCurveTo(s * 0.95, s * 0.75, s * 0.7, s * 0.85, s * 0.5, s * 0.5); x.fill(); x.beginPath(); x.arc(s * 0.5, s * 0.5, s * 0.06, 0, 7); x.fill(); }]
  ];
  /* an ornament as a see-through PNG canvas, in the colour asked for */
  FS.elementCanvas = function (id, color) {
    var e = FS.ELEMENTS.filter(function (x) { return x[0] === id; })[0]; if (!e) return null;
    var s = 600, c = document.createElement('canvas'); c.width = s; c.height = s; var x = c.getContext('2d');
    x.fillStyle = color || '#c9a45c'; x.strokeStyle = color || '#c9a45c'; e[3](x, s);
    // trim the empty margins so the ornament sizes and drags by what you see
    var d = x.getImageData(0, 0, s, s).data, x0 = s, y0 = s, x1 = 0, y1 = 0;
    for (var y = 0; y < s; y += 2) for (var xx = 0; xx < s; xx += 2) if (d[(y * s + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) return c;
    var pad = 6, t = document.createElement('canvas'); t.width = x1 - x0 + pad * 2; t.height = y1 - y0 + pad * 2;
    t.getContext('2d').drawImage(c, x0 - pad, y0 - pad, t.width, t.height, 0, 0, t.width, t.height); return t;
  };
  /* a line of text as an ornament (any font the page has loaded) */
  FS.textCanvas = function (text, font, color, weight) {
    var size = 160, c = document.createElement('canvas'), x = c.getContext('2d'); x.font = (weight || 700) + ' ' + size + 'px "' + (font || 'Heebo') + '"';
    var w = Math.ceil(x.measureText(text).width) + 40; c.width = Math.max(40, w); c.height = Math.round(size * 1.45);
    x = c.getContext('2d'); x.font = (weight || 700) + ' ' + size + 'px "' + (font || 'Heebo') + '"'; x.fillStyle = color || '#1d1633'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    x.fillText(text, c.width / 2, c.height / 2); return c;
  };

  /* ---------- a frame drawn by the image AI in the invitation's own design ----------
     The invitation goes to the hubs server's image model with the shape wanted; the model paints a finished frame in the
     same colours, paper and ornaments around a window of flat pure green, and the green is cut out here (with the green
     fringe cleaned), so the result is a PNG frame with a see-through window. */
  /* the invitation on a canvas of the frame's shape (image models answer in the shape they are given), on its own paper colour */
  function shot(img, long, W, H) { return shotCanvas(img, long, W, H).toDataURL('image/jpeg', 0.9).split(',')[1]; }
  FS.invShot = function (img, long, W, H) { return shotCanvas(img, long, W, H); };
  function shotCanvas(img, long, W, H) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, cw = W >= H ? long : Math.round(long * W / H), ch = W >= H ? Math.round(long * H / W) : long;
    var c = FS.canvas(cw, ch), x = c.getContext('2d'), t = FS.canvas(8, 8), tx = t.getContext('2d');
    tx.drawImage(img, 0, 0, 8, 8); var e = tx.getImageData(0, 0, 8, 8).data, r = 0, g = 0, b = 0, k2 = 0;
    for (var i = 0; i < 64; i++) { var X = i % 8, Y = i >> 3; if (X && X < 7 && Y && Y < 7) continue; r += e[i * 4]; g += e[i * 4 + 1]; b += e[i * 4 + 2]; k2++; }
    x.fillStyle = 'rgb(' + Math.round(r / k2) + ',' + Math.round(g / k2) + ',' + Math.round(b / k2) + ')'; x.fillRect(0, 0, cw, ch);
    var k = Math.min(cw * 0.94 / w, ch * 0.94 / h); x.imageSmoothingQuality = 'high'; x.drawImage(img, (cw - w * k) / 2, (ch - h * k) / 2, w * k, h * k);
    return c;
  }
  FS.invFramePrompt = function (W, H, o) {
    o = o || {};
    var shape = W > H * 1.05 ? 'landscape (wider than tall)' : H > W * 1.05 ? 'portrait (taller than wide)' : 'square';
    return 'This picture shows an event invitation (in the middle). Use it only as the design reference and create a NEW decorative photo frame for a fridge photo magnet, ' + shape + ', aspect ratio ' + W + ':' + H + '. ' +
      'Copy the invitation\'s exact visual identity: the same colour palette, background paper texture, ornaments, flowers, leaves, line work, gold or foil details and overall style, so it clearly belongs to the same event. ' +
      'Layout: an elegant decorative border around all four edges' + (o.band ? ', a little wider at the bottom' : '') + ', and one large empty photo window in the centre that covers about ' + Math.round((o.hole || 0.72) * 100) + '% of the frame. ' +
      'Fill the window with perfectly flat, solid, pure green (#00FF00), with clean sharp edges' + (o.round ? ' and softly rounded corners' : '') + '; nothing may overlap or be drawn inside the green window. ' +
      'No text, no letters, no names, no numbers, no people, no photo inside. Flat front view, the frame fills the whole image edge to edge, print quality, highly detailed.';
  };
  /* cut the green window: the green part that holds the centre (or the biggest green part) becomes transparent */
  FS.keyGreenWindow = function (img, W, H) {
    var c = FS.canvas(W, H), x = c.getContext('2d', { willReadFrequently: true }), iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var s = Math.max(W / iw, H / ih); x.imageSmoothingQuality = 'high'; x.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
    var d = x.getImageData(0, 0, W, H), px = d.data, n = W * H, g = new Uint8Array(n), i;
    function green(r, gg, b) { return gg > 120 && gg - r > 60 && gg - b > 60; }
    for (i = 0; i < n; i++) if (green(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])) g[i] = 1;
    /* connected green regions (4-neighbours), keep the one at the centre, else the largest */
    var lab = new Int32Array(n), q = new Int32Array(n), best = 0, bestN = 0, centre = 0, sizes = [0];
    for (i = 0; i < n; i++) {
      if (!g[i] || lab[i]) continue;
      var id = sizes.length, h = 0, t = 0, cnt = 0; lab[i] = id; q[t++] = i;
      while (h < t) { var v = q[h++], vx = v % W; cnt++;
        if (vx > 0 && g[v - 1] && !lab[v - 1]) { lab[v - 1] = id; q[t++] = v - 1; }
        if (vx < W - 1 && g[v + 1] && !lab[v + 1]) { lab[v + 1] = id; q[t++] = v + 1; }
        if (v >= W && g[v - W] && !lab[v - W]) { lab[v - W] = id; q[t++] = v - W; }
        if (v < n - W && g[v + W] && !lab[v + W]) { lab[v + W] = id; q[t++] = v + W; } }
      sizes.push(cnt); if (cnt > bestN) { bestN = cnt; best = id; }
    }
    var cid = lab[(H >> 1) * W + (W >> 1)]; if (cid && sizes[cid] > n * 0.08) best = cid;
    if (!best || sizes[best] < n * 0.08) return null;
    /* the window's box, and holes inside it (specks the model left) filled */
    var x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (i = 0; i < n; i++) if (lab[i] === best) { var xx = i % W, yy = (i / W) | 0; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    for (var y = y0; y <= y1; y++) { var row = y * W, a = -1, b2 = -1; for (var xq = x0; xq <= x1; xq++) if (lab[row + xq] === best) { if (a < 0) a = xq; b2 = xq; } if (a >= 0) for (xq = a; xq <= b2; xq++) lab[row + xq] = best; }
    /* transparent window with a 2px soft edge, and the green fringe around it pulled back to the frame's colours */
    for (i = 0; i < n; i++) {
      var r = px[i * 4], gg = px[i * 4 + 1], bb = px[i * 4 + 2];
      if (lab[i] === best) { px[i * 4 + 3] = 0; continue; }
      if (gg > r && gg > bb) { var near = false, X = i % W, Y = (i / W) | 0;
        for (var dy = -3; dy <= 3 && !near; dy++) for (var dx = -3; dx <= 3; dx++) { var j = (Y + dy) * W + X + dx; if (Y + dy >= 0 && Y + dy < H && X + dx >= 0 && X + dx < W && lab[j] === best) { near = true; break; } }
        if (near) { var m = Math.max(r, bb); px[i * 4 + 1] = Math.min(gg, m); if (green(r, gg, bb)) px[i * 4 + 3] = 90; } }
    }
    x.putImageData(d, 0, 0);
    return { canvas: c, hole: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, cover: sizes[best] / n };
  };
  FS.aiFrameFromInvite = function (img, W, H, o) {
    var ask = FS.askServer; if (!ask) return Promise.reject(new Error('offline'));
    var gw = W >= H ? 1024 : Math.round(1024 * W / H / 16) * 16, gh = W >= H ? Math.round(1024 * H / W / 16) * 16 : 1024;
    return ask({ action: 'restyle', prompt: FS.invFramePrompt(W, H, o), image: shot(img, 1280, W, H), small: shot(img, 496, W, H), mime: 'image/jpeg', w: gw, h: gh }).then(function (r) {
      if (!r || !r.ok || !r.image) throw new Error(r && r.error || 'ai-failed');
      var bin = atob(r.image), u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return FS.loadImg(URL.createObjectURL(new Blob([u8], { type: r.mime || 'image/png' })));
    }).then(function (res) {
      var k = FS.keyGreenWindow(res, W, H); if (!k) throw new Error('no-window'); return k;
    });
  };
})();
