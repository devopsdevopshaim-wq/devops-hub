/* 😜 Funny effects on the real photo, on this computer (no internet, no model download): the face landmarks (FaceSig, the
   MediaPipe face landmarker shipped with the site) place every effect on each face in the picture.
     bighead   ראש ענק          the head swollen inside a circle (a lens warp), the rest stays
     bigeyes   עיניים ענקיות     each eye magnified
     carica    קריקטורה          a big head, big eyes and a big smile together
     clown     ליצן              a shiny red nose and rosy cheeks
     swap      החלפת פנים        two people's faces swapped (similarity transform on the eyes, colour matched, soft edge)
     disguise  שפם ומשקפיים      round glasses and a curled mustache, drawn on the eye line
     crown     כתר               a gold crown with jewels on the head
   FS.funFx(id, img) -> Promise<canvas> (the photo's own size, at most 2400 px). Used by the quick workspace (mate.js) and
   by the magic mirror (mirror.html), where FS may be only a small shim. Rejects with Error('no-face') / Error('two-faces'). */
(function () {
  'use strict';
  var FS = window.FS = window.FS || {};
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  FS.FUN_FX = [['bighead', '🤯 ראש ענק'], ['bigeyes', '👀 עיניים ענקיות'], ['carica', '😜 קריקטורה'], ['swap', '🔄 החלפת פנים'],
    ['disguise', '🥸 שפם ומשקפיים'], ['crown', '👑 כתר'], ['clown', '🤡 ליצן']];
  var OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  /* every face: its points in the picture's own pixels, and a few measures */
  function faces(src) {
    if (!window.FaceSig) return Promise.reject(new Error('faces'));
    var W = src.naturalWidth || src.width;
    return window.FaceSig.detect(src, 1280).then(function (list) {
      return list.map(function (f) {
        var k = W / f.canvas.width, P = f.pts.map(function (p) { return { x: p.x * k, y: p.y * k }; });
        var e1 = P[468] || mid(P[33], P[133]), e2 = P[473] || mid(P[362], P[263]);
        if (e1.x > e2.x) { var t = e1; e1 = e2; e2 = t; }   /* e1 on the picture's left */
        var fh = dist(P[10], P[152]), fw = dist(P[234], P[454]), eyes = mid(e1, e2);
        return { P: P, e1: e1, e2: e2, eyes: eyes, fh: fh, fw: fw, ang: Math.atan2(e2.y - e1.y, e2.x - e1.x), ew: dist(P[33], P[133]),
          center: { x: (eyes.x + P[152].x) / 2, y: (eyes.y + P[152].y) / 2 }, mouth: mid(P[13], P[14]), mw: dist(P[61], P[291]) };
      }).filter(function (f) { return f.fh > 20; });
    });
  }

  /* a lens warp: inside the circle, a pixel at distance d (0..1) shows the source from d^p (p > 1 magnifies, p < 1 shrinks) */
  function bulge(img, cx, cy, r, p) {
    var W = img.width, H = img.height, s = img.data, out = new Uint8ClampedArray(s);
    var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) / r; if (d >= 1 || d === 0) continue;
      var k = Math.pow(d, p) / d;   /* d^p: 1 at the edge, so the circle's edge stays put */
      var sx = cx + dx * k, sy = cy + dy * k, ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) continue;
      var i00 = (iy * W + ix) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4, o = (y * W + x) * 4;
      for (var c = 0; c < 3; c++) out[o + c] = (s[i00 + c] * (1 - fx) + s[i10 + c] * fx) * (1 - fy) + (s[i01 + c] * (1 - fx) + s[i11 + c] * fx) * fy;
    }
    img.data.set(out);
  }
  /* an even zoom: inside t of the circle everything is scaled by z (the whole head, not just its middle), then a smooth
     (Hermite) blend back to the untouched picture at the circle's edge */
  function zoom(img, cx, cy, r, z, t) {
    var W = img.width, H = img.height, s = img.data, out = new Uint8ClampedArray(s), A = t / z, m0 = (1 - t) / z, m1 = 1 - t;
    var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) / r; if (d >= 1 || d === 0) continue;
      var g;
      if (d <= t) g = d / z;
      else { var u = (d - t) / (1 - t), u2 = u * u, u3 = u2 * u; g = (2 * u3 - 3 * u2 + 1) * A + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) + (u3 - u2) * m1; }
      var k = g / d, sx = cx + dx * k, sy = cy + dy * k, ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) continue;
      var i00 = (iy * W + ix) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4, o = (y * W + x) * 4;
      for (var c = 0; c < 3; c++) out[o + c] = (s[i00 + c] * (1 - fx) + s[i10 + c] * fx) * (1 - fy) + (s[i01 + c] * (1 - fx) + s[i11 + c] * fx) * fy;
    }
    img.data.set(out);
  }
  /* w: [cx, cy, r, p] a lens (bulge), or [cx, cy, r, z, t] an even zoom */
  function warps(c, list) {
    var x = c.getContext('2d', { willReadFrequently: true }), id = x.getImageData(0, 0, c.width, c.height);
    list.forEach(function (w) { if (w.length > 4) zoom(id, w[0], w[1], w[2], w[3], w[4]); else bulge(id, w[0], w[1], w[2], w[3]); });
    x.putImageData(id, 0, 0);
  }
  /* the head: centred a little above the face's middle, the circle wide enough that its even part holds the whole head */
  function head(f) { return [f.center.x, f.center.y - f.fh * 0.18, f.fh * 1.45]; }

  /* two faces swapped: each face (its inner oval, softened) moved onto the other by the eyes, its colour brought to the other's */
  function ovalPath(x, f, shrink) {
    var c = f.center; x.beginPath();
    OVAL.forEach(function (i, n) { var p = f.P[i], px = c.x + (p.x - c.x) * shrink, py = c.y + (p.y - c.y) * shrink; if (n) x.lineTo(px, py); else x.moveTo(px, py); });
    x.closePath();
  }
  function meanIn(src, f) {
    var m = canvas(src.width, src.height), x = m.getContext('2d', { willReadFrequently: true });
    ovalPath(x, f, 0.8); x.clip(); x.drawImage(src, 0, 0);
    var b = { x: Math.max(0, Math.floor(f.center.x - f.fw)), y: Math.max(0, Math.floor(f.center.y - f.fh)) };
    var w = Math.min(src.width - b.x, Math.ceil(f.fw * 2)), h = Math.min(src.height - b.y, Math.ceil(f.fh * 2)), d = x.getImageData(b.x, b.y, Math.max(1, w), Math.max(1, h)).data, t = [0, 0, 0], n = 0;
    for (var i = 0; i < d.length; i += 16) if (d[i + 3] > 200) { t[0] += d[i]; t[1] += d[i + 1]; t[2] += d[i + 2]; n++; }
    return n ? t.map(function (v) { return v / n; }) : [128, 128, 128];
  }
  function moveFace(out, src, a, b) {   /* a's face onto b */
    var W = src.width, H = src.height, s = dist(b.e1, b.e2) / dist(a.e1, a.e2), rot = b.ang - a.ang;
    var lay = canvas(W, H), lx = lay.getContext('2d', { willReadFrequently: true });
    lx.translate(b.eyes.x, b.eyes.y); lx.rotate(rot); lx.scale(s, s); lx.translate(-a.eyes.x, -a.eyes.y); lx.drawImage(src, 0, 0);
    lx.setTransform(1, 0, 0, 1, 0, 0);
    /* colour: a's skin brought to b's */
    var ma = meanIn(src, a), mb = meanIn(src, b), g = [mb[0] / ma[0], mb[1] / ma[1], mb[2] / ma[2]].map(function (v) { return Math.max(0.75, Math.min(1.33, v)); });
    var x0 = Math.max(0, Math.floor(b.center.x - b.fw)), y0 = Math.max(0, Math.floor(b.center.y - b.fh)), w = Math.max(1, Math.min(W - x0, Math.ceil(b.fw * 2))), h = Math.max(1, Math.min(H - y0, Math.ceil(b.fh * 2)));
    var id = lx.getImageData(x0, y0, w, h); for (var i = 0; i < id.data.length; i += 4) { id.data[i] *= g[0]; id.data[i + 1] *= g[1]; id.data[i + 2] *= g[2]; } lx.putImageData(id, x0, y0);
    /* a soft-edged mask of b's inner face */
    var m = canvas(W, H), mx = m.getContext('2d'); mx.filter = 'blur(' + Math.max(2, Math.round(b.fh * 0.05)) + 'px)'; mx.fillStyle = '#fff'; ovalPath(mx, b, 0.86); mx.fill();
    lx.globalCompositeOperation = 'destination-in'; lx.drawImage(m, 0, 0);
    out.getContext('2d').drawImage(lay, 0, 0);
  }

  /* drawn props, on the face's eye line */
  function disguise(x, f) {
    var r = f.ew * 0.95, lw = Math.max(3, f.ew * 0.16);
    x.save(); x.translate(f.eyes.x, f.eyes.y); x.rotate(f.ang); var half = dist(f.e1, f.e2) / 2;
    x.lineWidth = lw; x.strokeStyle = '#111'; x.fillStyle = 'rgba(120,170,220,.18)';
    [-half, half].forEach(function (dx) { x.beginPath(); x.arc(dx, 0, r, 0, 6.29); x.fill(); x.stroke(); });
    x.beginPath(); x.moveTo(-half + r, -r * 0.15); x.quadraticCurveTo(0, -r * 0.6, half - r, -r * 0.15); x.stroke();
    x.beginPath(); x.moveTo(-half - r, -r * 0.1); x.lineTo(-half - r * 1.9, -r * 0.35); x.moveTo(half + r, -r * 0.1); x.lineTo(half + r * 1.9, -r * 0.35); x.stroke();
    /* the mustache, between the nose and the lip */
    var nose = f.P[2], lip = f.P[0] || f.P[13], my = ((nose.x - f.eyes.x) * Math.sin(-f.ang) + (nose.y - f.eyes.y) * Math.cos(-f.ang) + (lip.x - f.eyes.x) * Math.sin(-f.ang) + (lip.y - f.eyes.y) * Math.cos(-f.ang)) / 2;
    var mx = ((nose.x - f.eyes.x) * Math.cos(-f.ang) - (nose.y - f.eyes.y) * Math.sin(-f.ang)), mw = f.mw * 0.85;
    x.fillStyle = '#2b1a10'; x.beginPath(); x.moveTo(mx, my - mw * 0.05);
    x.bezierCurveTo(mx + mw * 0.35, my - mw * 0.3, mx + mw * 0.75, my - mw * 0.05, mx + mw * 1.05, my - mw * 0.35);
    x.bezierCurveTo(mx + mw * 0.95, my + mw * 0.15, mx + mw * 0.4, my + mw * 0.2, mx, my + mw * 0.08);
    x.bezierCurveTo(mx - mw * 0.4, my + mw * 0.2, mx - mw * 0.95, my + mw * 0.15, mx - mw * 1.05, my - mw * 0.35);
    x.bezierCurveTo(mx - mw * 0.75, my - mw * 0.05, mx - mw * 0.35, my - mw * 0.3, mx, my - mw * 0.05); x.fill();
    x.restore();
  }
  function crown(x, f) {
    var top = f.P[10], w = f.fw * 0.85, h = f.fh * 0.42, up = f.fh * 0.06;
    x.save(); x.translate(top.x + Math.sin(f.ang) * up, top.y - Math.cos(f.ang) * up); x.rotate(f.ang);
    var g = x.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.45, '#f5c542'); g.addColorStop(1, '#b8860b');
    x.fillStyle = g; x.strokeStyle = '#7a5a06'; x.lineWidth = Math.max(2, w * 0.015);
    x.beginPath(); x.moveTo(-w / 2, 0); x.lineTo(-w / 2, -h * 0.55); x.lineTo(-w / 4, -h * 0.25); x.lineTo(0, -h); x.lineTo(w / 4, -h * 0.25); x.lineTo(w / 2, -h * 0.55); x.lineTo(w / 2, 0); x.closePath(); x.fill(); x.stroke();
    x.fillRect(-w / 2, -h * 0.12, w, h * 0.14); x.strokeRect(-w / 2, -h * 0.12, w, h * 0.14);
    [['#e0115f', 0, -h * 0.05], ['#0f52ba', -w * 0.28, -h * 0.05], ['#50c878', w * 0.28, -h * 0.05]].forEach(function (j) { x.fillStyle = j[0]; x.beginPath(); x.arc(j[1], j[2], w * 0.045, 0, 6.29); x.fill(); });
    [[-w / 2, -h * 0.55], [0, -h], [w / 2, -h * 0.55]].forEach(function (pt) { x.fillStyle = '#fff8dc'; x.beginPath(); x.arc(pt[0], pt[1], w * 0.035, 0, 6.29); x.fill(); });
    x.restore();
  }

  function clown(x, f) {
    var n = f.P[4] || f.P[1], r = f.ew * 0.75;
    [f.P[50], f.P[280]].forEach(function (ch) {   /* the cheeks */
      if (!ch) return; var g = x.createRadialGradient(ch.x, ch.y, 0, ch.x, ch.y, f.ew * 0.9);
      g.addColorStop(0, 'rgba(255,70,90,.45)'); g.addColorStop(1, 'rgba(255,70,90,0)'); x.fillStyle = g; x.beginPath(); x.arc(ch.x, ch.y, f.ew * 0.9, 0, 6.29); x.fill();
    });
    x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = r * 0.5; x.shadowOffsetY = r * 0.2;
    var g = x.createRadialGradient(n.x - r * 0.35, n.y - r * 0.35, r * 0.1, n.x, n.y, r);
    g.addColorStop(0, '#ff8a8a'); g.addColorStop(0.35, '#e8141e'); g.addColorStop(1, '#8e0008'); x.fillStyle = g; x.beginPath(); x.arc(n.x, n.y, r, 0, 6.29); x.fill(); x.restore();
    x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(n.x - r * 0.35, n.y - r * 0.4, r * 0.22, r * 0.14, -0.6, 0, 6.29); x.fill();
  }
  FS.funFx = function (id, src) {
    var W0 = src.naturalWidth || src.width, H0 = src.naturalHeight || src.height, k = Math.min(1, 2400 / Math.max(W0, H0));
    var c = canvas(W0 * k, H0 * k), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    return faces(c).then(function (F) {
      if (!F.length) throw new Error('no-face');
      if (id === 'bighead') warps(c, F.map(function (f) { var h = head(f); return [h[0], h[1], h[2], 1.38, 0.58]; }));
      else if (id === 'bigeyes') warps(c, [].concat.apply([], F.map(function (f) { return [[f.e1.x, f.e1.y, f.ew * 1.3, 2.1], [f.e2.x, f.e2.y, f.ew * 1.3, 2.1]]; })));
      else if (id === 'carica') warps(c, [].concat.apply([], F.map(function (f) { var h = head(f), z = 1.3; return [[h[0], h[1], h[2], z, 0.58], [h[0] + (f.e1.x - h[0]) * z, h[1] + (f.e1.y - h[1]) * z, f.ew * 1.25 * z, 1.7], [h[0] + (f.e2.x - h[0]) * z, h[1] + (f.e2.y - h[1]) * z, f.ew * 1.25 * z, 1.7], [h[0] + (f.mouth.x - h[0]) * z, h[1] + (f.mouth.y - h[1]) * z, f.mw * 0.8 * z, 1.35]]; })));
      else if (id === 'swap') {
        if (F.length < 2) throw new Error('two-faces');
        F.sort(function (a, b) { return b.fh - a.fh; }); var A = F[0], B = F[1], orig = canvas(c.width, c.height); orig.getContext('2d').drawImage(c, 0, 0);
        moveFace(c, orig, A, B); moveFace(c, orig, B, A);
      }
      else if (id === 'disguise') F.forEach(function (f) { disguise(x, f); });
      else if (id === 'crown') F.forEach(function (f) { crown(x, f); });
      else if (id === 'clown') F.forEach(function (f) { clown(x, f); });
      else throw new Error('fx');
      return c;
    });
  };
  FS.funFxMsg = function (e) { var m = e && e.message; return m === 'no-face' ? 'לא נמצאו פנים בתמונה' : m === 'two-faces' ? 'להחלפת פנים צריך לפחות שני אנשים בתמונה' : 'האפקט לא הצליח'; };
})();
