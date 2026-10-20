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
})();
